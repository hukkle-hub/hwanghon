/* Field rig input: skill clips are actions too. Passing null made Ain keep
 * carrying the scythe while the body played a skill; Kain released his left
 * hand. Use the same clip time for body and grip, not the previous frame. */
import {contactOf} from './field-feel.js';
export function fieldHeroAction(character,clip,time,id){
 if(!clip||! /^(attack[123]|smash|skill[1-4]|ult|counter|exec)$/.test(clip.name))return null;
 const duration=clip.duration;
 return {id,clip:clip.name,kind:/^skill/.test(clip.name)?'skill':clip.name==='counter'?'counter':'light',
  duration,elapsed:Math.max(0,Math.min(duration,time)),hitAt:contactOf(character,clip.name)*duration,combo:0};
}
