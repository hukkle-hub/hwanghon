import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const INSTANCE_SECRET = process.env.INSTANCE_SECRET || "";
// HwanghonCombatUE (doc 153): no built-in secret - servers and matchmaker share one from the environment or nothing runs
if (!INSTANCE_SECRET || INSTANCE_SECRET === "change-me") {
  console.error("[Hwanghon matchmaker] INSTANCE_SECRET missing or the placeholder - refusing to start");
  process.exit(1);
}
const STALE_MS = Number(process.env.STALE_MS || 15000);
const TICKET_MS = Number(process.env.TICKET_MS || 90000);
const DUNGEON_RESERVATION_MS = Number(process.env.DUNGEON_RESERVATION_MS || 90000);

const instances = new Map();
const shelterTickets = new Map();
const dungeonTickets = new Map();

const CHARACTERS = new Set(["ain","kain","ryu","sera"]);

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 128 * 1024) throw new Error("payload too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function requireInternal(req, res) {
  if ((req.headers["x-instance-secret"] || "") !== INSTANCE_SECRET) {
    json(res, 401, {error:"unauthorized"});
    return false;
  }
  return true;
}

function prune() {
  const now = Date.now();

  for (const [id, inst] of instances) {
    if (now - inst.lastSeen > STALE_MS) {
      instances.delete(id);
      continue;
    }
    if (inst.reservedUntil && inst.reservedUntil < now && inst.players === 0) {
      inst.reservedPartyId = "";
      inst.reservedUntil = 0;
    }
  }

  for (const [token, t] of shelterTickets) {
    if (t.expiresAt < now) shelterTickets.delete(token);
  }
  for (const [token, t] of dungeonTickets) {
    if (t.expiresAt < now) dungeonTickets.delete(token);
  }
}

function liveTicketReservationsForShelter(instanceId) {
  const now = Date.now();
  let n = 0;
  for (const t of shelterTickets.values()) {
    if (!t.consumed && t.instanceId === instanceId && t.expiresAt > now) n++;
  }
  return n;
}

function pickShelter(requiredSlots = 1) {
  prune();
  return [...instances.values()]
    .filter(x => x.kind === "shelter")
    .filter(x => x.players + liveTicketReservationsForShelter(x.instanceId) + requiredSlots <= x.capacity)
    .sort((a,b) => {
      const la = (a.players + liveTicketReservationsForShelter(a.instanceId)) / a.capacity;
      const lb = (b.players + liveTicketReservationsForShelter(b.instanceId)) / b.capacity;
      return la - lb || a.players - b.players || a.instanceId.localeCompare(b.instanceId);
    })[0] || null;
}

function pickDungeon(missionId, partySize) {
  prune();
  const now = Date.now();
  return [...instances.values()]
    .filter(x => x.kind === "dungeon")
    .filter(x => x.players === 0)
    .filter(x => x.capacity >= partySize)
    .filter(x => !x.reservedPartyId || x.reservedUntil < now)
    .filter(x => !x.missionId || x.missionId === "*" || x.missionId === missionId)
    .sort((a,b) => a.lastSeen - b.lastSeen || a.instanceId.localeCompare(b.instanceId))[0] || null;
}

function issueShelterTicket({
  target,
  accountId,
  character,
  partyId = "",
  leaderAccountId = "",
  partyLeader = false,
  source = "login",
  spawnPoint = "TownStart",
  originShelterInstanceId = ""
}) {
  const token = crypto.randomUUID();
  shelterTickets.set(token, {
    instanceId:target.instanceId,
    accountId,
    character,
    partyId,
    leaderAccountId,
    partyLeader,
    source,
    spawnPoint,
    originShelterInstanceId:originShelterInstanceId || target.instanceId,
    expiresAt:Date.now()+TICKET_MS,
    consumed:false
  });
  return token;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      prune();
      return json(res, 200, {
        ok:true,
        instances:instances.size,
        shelters:[...instances.values()].filter(x=>x.kind==="shelter").length,
        dungeons:[...instances.values()].filter(x=>x.kind==="dungeon").length,
        shelterTickets:shelterTickets.size,
        dungeonTickets:dungeonTickets.size
      });
    }

    if (req.method === "GET" && url.pathname === "/v1/status") {
      if (!requireInternal(req, res)) return;   // server-to-server only (doc 153)
      prune();
      return json(res, 200, {
        instances:[...instances.values()].map(x => ({
          instanceId:x.instanceId,
          kind:x.kind,
          map:x.map,
          missionId:x.missionId || "",
          players:x.players,
          capacity:x.capacity,
          address:x.address,
          reservedPartyId:x.reservedPartyId || "",
          pendingShelterTickets:x.kind==="shelter" ? liveTicketReservationsForShelter(x.instanceId) : 0
        }))
      });
    }

    if (req.method === "POST" && url.pathname === "/internal/instances/heartbeat") {
      if (!requireInternal(req,res)) return;

      const body = await readJson(req);
      const instanceId = String(body.instanceId || "").trim();
      const address = String(body.address || "").trim();
      const kind = String(body.kind || "shelter").trim();
      const map = String(body.map || kind).trim();
      const missionId = String(body.missionId || "*").trim();
      const players = Math.max(0, Number(body.players || 0));
      const capacity = Math.max(1, Number(body.capacity || (kind === "dungeon" ? 4 : 24)));

      if (!instanceId || !address) return json(res, 400, {error:"instanceId/address required"});
      if (!["shelter","dungeon"].includes(kind)) return json(res, 400, {error:"invalid kind"});

      const prev = instances.get(instanceId) || {};
      instances.set(instanceId, {
        ...prev, instanceId,address,kind,map,missionId,players,capacity,lastSeen:Date.now()
      });
      return json(res, 200, {ok:true});
    }

    if (req.method === "POST" && url.pathname === "/v1/match/shelter") {
      const body = await readJson(req);
      const character = String(body.character || "").toLowerCase();
      const accountId = String(body.accountId || "").trim();

      if (!CHARACTERS.has(character)) return json(res,400,{error:"invalid character"});
      if (!accountId) return json(res,400,{error:"accountId required"});

      const target = pickShelter(1);
      if (!target) return json(res,503,{error:"no shelter instance available"});

      const joinToken = issueShelterTicket({target,accountId,character,source:"login",spawnPoint:"TownStart",originShelterInstanceId:target.instanceId});

      return json(res,200,{
        instanceId:target.instanceId,
        address:target.address,
        joinToken,
        character,
        capacity:target.capacity,
        players:target.players
      });
    }

    if (req.method === "POST" && url.pathname === "/internal/shelter-tickets/consume") {
      if (!requireInternal(req,res)) return;
      prune();

      const body = await readJson(req);
      const token = String(body.token || "");
      const instanceId = String(body.instanceId || "");
      const ticket = shelterTickets.get(token);

      if (!ticket) return json(res,404,{error:"ticket not found"});
      if (ticket.expiresAt < Date.now()) {
        shelterTickets.delete(token);
        return json(res,410,{error:"ticket expired"});
      }
      if (ticket.consumed) return json(res,409,{error:"ticket already consumed"});
      if (ticket.instanceId !== instanceId) return json(res,403,{error:"wrong instance"});

      ticket.consumed = true;
      return json(res,200,{
        ok:true,
        accountId:ticket.accountId,
        character:ticket.character,
        partyId:ticket.partyId || "",
        leaderAccountId:ticket.leaderAccountId || "",
        partyLeader:!!ticket.partyLeader,
        source:ticket.source,
        spawnPoint:ticket.spawnPoint || "TownStart",
        originShelterInstanceId:ticket.originShelterInstanceId || ticket.instanceId
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/match/dungeon") {
      if (!requireInternal(req, res)) return;   // server-to-server only (doc 153)
      const body = await readJson(req);
      const partyId = String(body.partyId || "").trim();
      const missionId = String(body.missionId || "").trim();
      const leaderAccountId = String(body.leaderAccountId || "").trim();
      const originShelterInstanceId = String(body.originShelterInstanceId || "").trim();
      const members = Array.isArray(body.members) ? body.members : [];

      if (!partyId || !missionId || !leaderAccountId) {
        return json(res,400,{error:"partyId/missionId/leaderAccountId required"});
      }
      if (members.length < 1 || members.length > 4) {
        return json(res,400,{error:"party size must be 1..4"});
      }

      const seen = new Set();
      for (const m of members) {
        const accountId = String(m?.accountId || "").trim();
        const character = String(m?.character || "").toLowerCase();
        if (!accountId || seen.has(accountId)) return json(res,400,{error:"invalid accountId"});
        if (!CHARACTERS.has(character)) return json(res,400,{error:"invalid character"});
        seen.add(accountId);
      }

      if (!seen.has(leaderAccountId)) return json(res,400,{error:"leader missing from members"});

      const target = pickDungeon(missionId, members.length);
      if (!target) return json(res,503,{error:"no dungeon instance available"});

      target.reservedPartyId = partyId;
      target.reservedUntil = Date.now()+DUNGEON_RESERVATION_MS;

      const tickets = {};
      for (const m of members) {
        const accountId = String(m.accountId);
        const token = crypto.randomUUID();
        tickets[accountId] = token;

        dungeonTickets.set(token,{
          instanceId:target.instanceId,
          partyId,
          accountId,
          character:String(m.character).toLowerCase(),
          partyLeader:accountId === leaderAccountId,
          leaderAccountId,
          originShelterInstanceId,
          missionId,
          expiresAt:Date.now()+TICKET_MS,
          consumed:false
        });
      }

      return json(res,200,{
        instanceId:target.instanceId,
        address:target.address,
        partyId,
        missionId,
        tickets
      });
    }

    if (req.method === "POST" && url.pathname === "/internal/dungeon-tickets/consume") {
      if (!requireInternal(req,res)) return;
      prune();

      const body = await readJson(req);
      const token = String(body.token || "");
      const instanceId = String(body.instanceId || "");
      const ticket = dungeonTickets.get(token);

      if (!ticket) return json(res,404,{error:"ticket not found"});
      if (ticket.expiresAt < Date.now()) {
        dungeonTickets.delete(token);
        return json(res,410,{error:"ticket expired"});
      }
      if (ticket.consumed) return json(res,409,{error:"ticket already consumed"});
      if (ticket.instanceId !== instanceId) return json(res,403,{error:"wrong instance"});

      ticket.consumed = true;
      return json(res,200,{
        ok:true,
        partyId:ticket.partyId,
        accountId:ticket.accountId,
        character:ticket.character,
        partyLeader:!!ticket.partyLeader,
        leaderAccountId:ticket.leaderAccountId,
        originShelterInstanceId:ticket.originShelterInstanceId || "",
        missionId:ticket.missionId
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/match/return-shelter") {
      if (!requireInternal(req, res)) return;   // server-to-server only (doc 153)
      const body = await readJson(req);
      const partyId = String(body.partyId || "").trim();
      const leaderAccountId = String(body.leaderAccountId || "").trim();
      const missionId = String(body.missionId || "").trim();
      const preferredShelterInstanceId = String(body.preferredShelterInstanceId || "").trim();
      const members = Array.isArray(body.members) ? body.members : [];

      if (!partyId || !leaderAccountId || members.length < 1 || members.length > 4) {
        return json(res,400,{error:"invalid return party"});
      }

      prune();

      let target = null;
      if (preferredShelterInstanceId) {
        const preferred = instances.get(preferredShelterInstanceId);
        if (
          preferred &&
          preferred.kind === "shelter" &&
          preferred.players + liveTicketReservationsForShelter(preferred.instanceId) + members.length <= preferred.capacity
        ) {
          target = preferred;
        }
      }

      if (!target) target = pickShelter(members.length);
      if (!target) return json(res,503,{error:"no shelter capacity for returning party"});

      const tickets = {};
      for (const m of members) {
        const accountId = String(m?.accountId || "").trim();
        const character = String(m?.character || "").toLowerCase();
        if (!accountId || !CHARACTERS.has(character)) return json(res,400,{error:"invalid return member"});

        tickets[accountId] = issueShelterTicket({
          target,
          accountId,
          character,
          partyId,
          leaderAccountId,
          partyLeader:accountId===leaderAccountId,
          source:`return:${missionId}`,
          spawnPoint:"ManpowerOfficeReturn",
          originShelterInstanceId:target.instanceId
        });
      }

      return json(res,200,{
        instanceId:target.instanceId,
        address:target.address,
        partyId,
        tickets
      });
    }

    return json(res,404,{error:"not found"});
  } catch (err) {
    return json(res,500,{error:String(err?.message || err)});
  }
});

server.listen(PORT,"0.0.0.0",()=>{
  console.log(`[Hwanghon matchmaker v6] listening on :${PORT}`);
});
