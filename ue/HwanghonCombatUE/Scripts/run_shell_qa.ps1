param(
    [string]$UERoot = $env:UE55_ROOT,
    [string]$Project = (Join-Path (Split-Path -Parent $PSScriptRoot) 'HwanghonCombatUE.uproject'),
    [string]$OutputRoot,
    [ValidateRange(100, 900)][int]$ProcessTimeoutSeconds = 300
)

# Assumes the native Editor target and ue_setup.py bootstrap assets already exist.
# The runtime driver uses real Slate input routing and isolated automation saves.
# This script intentionally does not build, alter EngineAssociation, or package.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function ConvertTo-HWWindowsArgument {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    if ($Value.IndexOf([char]0) -ge 0 -or $Value.Contains("`r") -or $Value.Contains("`n")) {
        throw 'A native process argument contains an unsupported control character.'
    }
    # Start-Process passes one Windows command line; this is CRT quoting, not
    # shell interpolation. Double slashes before quotes and the closing quote.
    $Escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $Escaped = [regex]::Replace($Escaped, '(\\+)$', '$1$1')
    return '"' + $Escaped + '"'
}

function Assert-HWShellCondition {
    param([bool]$Condition, [string]$Message)
    if (!$Condition) { throw $Message }
}

function Get-HWPngSize {
    param([string]$Path)
    $Stream = [IO.File]::OpenRead($Path)
    try {
        $Header = New-Object byte[] 24
        Assert-HWShellCondition ($Stream.Read($Header, 0, 24) -eq 24) "PNG header is truncated: $Path"
        $Signature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
        for ($Index = 0; $Index -lt 8; $Index++) {
            Assert-HWShellCondition ($Header[$Index] -eq $Signature[$Index]) "Invalid PNG signature: $Path"
        }
        Assert-HWShellCondition ([Text.Encoding]::ASCII.GetString($Header, 12, 4) -ceq 'IHDR') "PNG lacks an IHDR: $Path"
        $Width = [long]$Header[16] * 16777216 + [long]$Header[17] * 65536 + [long]$Header[18] * 256 + $Header[19]
        $Height = [long]$Header[20] * 16777216 + [long]$Header[21] * 65536 + [long]$Header[22] * 256 + $Header[23]
        return [pscustomobject]@{ Width = $Width; Height = $Height; Bytes = $Stream.Length }
    } finally { $Stream.Dispose() }
}

function Assert-HWShellReport {
    param(
        [string]$RunDirectory, [datetime]$StartedUtc, [string]$Scenario,
        [string]$Slot, [int]$Width, [int]$Height
    )
    $ReportPath = Join-Path $RunDirectory 'shell-qa.json'
    Assert-HWShellCondition (Test-Path -LiteralPath $ReportPath -PathType Leaf) "Runtime report missing: $ReportPath"
    Assert-HWShellCondition ((Get-Item -LiteralPath $ReportPath).LastWriteTimeUtc -ge $StartedUtc) "Runtime report is stale: $ReportPath"
    $Text = Get-Content -LiteralPath $ReportPath -Raw
    Assert-HWShellCondition ($Text.TrimStart().StartsWith('{')) 'Runtime report must be a JSON object.'
    $Data = $Text | ConvertFrom-Json
    Assert-HWShellCondition ($Data.TestSuccess -is [bool] -and $Data.TestSuccess) "Runtime QA failed at $($Data.LastStage): $($Data.Diagnostic)"
    Assert-HWShellCondition ($Data.Scenario -ceq $Scenario -and $Data.ProfileSlot -ceq $Slot) 'Runtime report belongs to a different scenario or save slot.'
    # Capture the conditional output as an array; a single reload/lobby name
    # otherwise unwraps to a string and StrictMode rejects its Count property.
    $ExpectedNames = @(if ($Scenario -ceq 'full') {
        'lobby', 'combat', 'victory-unsaved', 'victory', 'defeat', 'lobby-after', 'leave-confirmation', 'lobby-abandoned'
    } elseif ($Scenario -ceq 'reload') { 'lobby-reloaded' } else { 'lobby' })
    $Screenshots = @($Data.Screenshots)
    Assert-HWShellCondition ($Screenshots.Count -eq $ExpectedNames.Count) 'Screenshot count does not match the completed scenario.'
    $Seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $TotalVisible = 0
    $TotalScrollRows = 0
    foreach ($Capture in $Screenshots) {
        Assert-HWShellCondition ($ExpectedNames -ccontains $Capture.Name) "Unexpected screenshot name: $($Capture.Name)"
        Assert-HWShellCondition ($Seen.Add([string]$Capture.Name)) "Duplicate screenshot: $($Capture.Name)"
        $PngPath = Join-Path $RunDirectory ($Capture.Name + '.png')
        Assert-HWShellCondition ([IO.Path]::GetFullPath([string]$Capture.File) -ceq [IO.Path]::GetFullPath($PngPath)) 'Screenshot points outside this run directory.'
        Assert-HWShellCondition (Test-Path -LiteralPath $PngPath -PathType Leaf) "Screenshot file missing: $PngPath"
        Assert-HWShellCondition ((Get-Item -LiteralPath $PngPath).LastWriteTimeUtc -ge $StartedUtc) "Screenshot file is stale: $PngPath"
        $Png = Get-HWPngSize $PngPath
        Assert-HWShellCondition ($Png.Width -eq $Width -and $Png.Height -eq $Height) "Wrong PNG dimensions: $PngPath ($($Png.Width)x$($Png.Height))"
        Assert-HWShellCondition ($Capture.ViewportWidth -eq $Width -and $Capture.ViewportHeight -eq $Height) 'Reported viewport does not match the requested dimensions.'
        Assert-HWShellCondition ($Capture.FileVerified -is [bool] -and $Capture.FileVerified -and $Capture.LayoutPass -is [bool] -and $Capture.LayoutPass) 'Runtime did not verify screenshot or layout.'
        Assert-HWShellCondition ($Png.Bytes -eq $Capture.FileBytes -and $Png.Bytes -gt 24) 'Screenshot file length differs from runtime evidence.'
        Assert-HWShellCondition ($Capture.ControlsBelow64Px -eq 0 -and $Capture.ClippedVisibleControls -eq 0) 'Runtime detected small or clipped controls.'
        $Visible = @($Capture.Controls | Where-Object { $_.Enabled -eq $true -and $_.CenterVisible -eq $true })
        Assert-HWShellCondition ($Visible.Count -gt 0 -and $Visible.Count -eq $Capture.VisibleEnabledControls) 'Visible control count is missing or inconsistent.'
        $ScrollClipped = 0
        foreach ($Control in $Visible) {
            Assert-HWShellCondition ($Control.Width -ge 63.5 -and $Control.Height -ge 63.5 -and $Control.AtLeast64Px -eq $true) "Small control: $($Capture.Name)/$($Control.Tag)"
            Assert-HWShellCondition ($Control.X -ge -0.5 -and ($Control.X + $Control.Width) -le ($Width + 0.5)) "Control horizontally outside viewport: $($Capture.Name)/$($Control.Tag)"
            if ($Control.ExpectedScrollClipping -eq $true) {
                # Only vertically clipped selection rows in the dedicated quest
                # list are expected. The C++ click driver separately requires
                # every clicked target to be fully exposed, including these rows.
                $SelectionRow = $Control.Tag -ceq 'HW.Training' -or $Control.Tag.StartsWith('HW.Quest.', [StringComparison]::Ordinal)
                Assert-HWShellCondition ($SelectionRow -and $Control.InQuestListScroll -eq $true -and $Control.HorizontalUnclipped -eq $true -and $Control.Unclipped -eq $false) "Invalid scroll clipping exception: $($Capture.Name)/$($Control.Tag)"
                Assert-HWShellCondition ($Control.ClipTop -ge -0.5 -and $Control.ClipBottom -le ($Height + 0.5) -and $Control.ClipBottom -gt $Control.ClipTop) 'Quest list clip is outside the viewport.'
                Assert-HWShellCondition ($Control.VisibleWidth -ge 63.5 -and $Control.VisibleHeight -gt 0 -and $Control.VisibleHeight -lt $Control.Height) 'Expected scroll row must have a measured partial vertical extent.'
                $ScrollClipped++
            } else {
                Assert-HWShellCondition ($Control.Y -ge -0.5 -and ($Control.Y + $Control.Height) -le ($Height + 0.5)) "Control vertically outside viewport: $($Capture.Name)/$($Control.Tag)"
                Assert-HWShellCondition ($Control.WithinViewport -eq $true -and $Control.Unclipped -eq $true) "Unexpected clipped control: $($Capture.Name)/$($Control.Tag)"
            }
        }
        Assert-HWShellCondition ($Capture.ScrollClippedRows -eq $ScrollClipped) 'Scroll clipping count is inconsistent with the measured rows.'
        $TotalScrollRows += $ScrollClipped
        $TotalVisible += $Visible.Count
    }
    if ($Scenario -ceq 'full') {
        Assert-HWShellCondition ($Data.InitialTutorialClears -eq 0 -and $Data.FinalTutorialClears -eq 1) 'A fresh full scenario must commit exactly one tutorial clear.'
        Assert-HWShellCondition ($Data.RoutedAttackCausedRealContact -eq $true -and $Data.BossHealthAfterRoutedAttack -lt $Data.BossHealthBeforeRoutedAttack) 'No real boss damage was produced by the routed attack.'
        $FirstRun = [guid]::Parse([string]$Data.FirstRunId)
        $RetryRun = [guid]::Parse([string]$Data.RetryRunId)
        Assert-HWShellCondition ($FirstRun -ne [guid]::Empty -and $RetryRun -ne [guid]::Empty -and $FirstRun -ne $RetryRun) 'Retry did not have a distinct valid run identity.'
        $AbandonRun = [guid]::Parse([string]$Data.AbandonRunId)
        Assert-HWShellCondition ($AbandonRun -ne [guid]::Empty -and $AbandonRun -ne $FirstRun -and $AbandonRun -ne $RetryRun) 'The later abandoned encounter reused a run identity.'
        Assert-HWShellCondition ($Data.LeaveConfirmationPausedWorld -eq $true -and $Data.CancelLeaveRestoredCombat -eq $true -and $Data.ConfirmedAbandonReturnedToLobby -eq $true) 'Leave confirmation did not verify pause, cancel, and safe abandon return.'
        $ExpectedClicks = @('HW.Launch', 'HW.Lock', 'HW.Attack', 'HW.RetrySave', 'HW.RetryEncounter', 'HW.Return',
            'HW.Launch', 'HW.Leave', 'HW.CancelLeave', 'HW.Leave', 'HW.ConfirmLeave')
        $Clicks = @($Data.Interactions)
        Assert-HWShellCondition ($Clicks.Count -eq $ExpectedClicks.Count) 'The required Slate click sequence is incomplete.'
        for ($Index = 0; $Index -lt $ExpectedClicks.Count; $Index++) {
            Assert-HWShellCondition ($Clicks[$Index].Tag -ceq $ExpectedClicks[$Index] -and $Clicks[$Index].PointerDownHandled -eq $true -and $Clicks[$Index].PointerUpHandled -eq $true -and $Clicks[$Index].FullyVisible -eq $true -and $Clicks[$Index].Width -ge 63.5 -and $Clicks[$Index].Height -ge 63.5) "Required fully visible Slate click failed: $($ExpectedClicks[$Index])"
        }
    } elseif ($Scenario -ceq 'reload') {
        Assert-HWShellCondition ($Data.InitialTutorialClears -eq 1 -and $Data.FinalTutorialClears -eq 1) 'Reload did not preserve exactly one saved tutorial clear.'
    }
    return [pscustomobject]@{
        ReportPath = $ReportPath
        ScreenshotCount = $Screenshots.Count
        VisibleControlMeasurements = $TotalVisible
        ExpectedScrollClippedRowMeasurements = $TotalScrollRows
        InitialTutorialClears = $Data.InitialTutorialClears
        FinalTutorialClears = $Data.FinalTutorialClears
    }
}

if ([string]::IsNullOrWhiteSpace($UERoot)) { throw 'Set UE55_ROOT or provide -UERoot for the installed engine.' }
$UERoot = [IO.Path]::GetFullPath($UERoot)
$Project = [IO.Path]::GetFullPath($Project)
$ProjectDirectory = Split-Path -Parent $Project
$Editor = Join-Path $UERoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$VersionPath = Join-Path $UERoot 'Engine\Build\Build.version'
$RequiredFiles = @(
    $Project, $Editor, $VersionPath,
    (Join-Path $ProjectDirectory 'Binaries\Win64\UnrealEditor-HwanghonCombatUE.dll'),
    (Join-Path $ProjectDirectory 'Content\Maps\HW_Lobby.umap'),
    (Join-Path $ProjectDirectory 'Content\Maps\HW_Training.umap')
)
foreach ($Required in $RequiredFiles) {
    Assert-HWShellCondition (Test-Path -LiteralPath $Required -PathType Leaf) "Required build/bootstrap file missing: $Required"
}
$ProjectData = Get-Content -LiteralPath $Project -Raw | ConvertFrom-Json
$Version = Get-Content -LiteralPath $VersionPath -Raw | ConvertFrom-Json
$EngineVersion = "$($Version.MajorVersion).$($Version.MinorVersion).$($Version.PatchVersion)"
$TargetVersion = [string]$ProjectData.EngineAssociation
$EngineMatches = $TargetVersion -ceq "$($Version.MajorVersion).$($Version.MinorVersion)" -or $TargetVersion -ceq $EngineVersion
if (!$EngineMatches) {
    Write-Warning "DIAGNOSTIC ONLY: project target is UE $TargetVersion; selected engine is UE $EngineVersion. Passing this run does not validate UE $TargetVersion. EngineAssociation will not be changed."
}
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProjectDirectory 'Saved\ShellQA' }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Unique = [guid]::NewGuid().ToString('N')
$BatchDirectory = Join-Path $OutputRoot ((Get-Date -Format 'yyyyMMdd_HHmmss') + '_' + $Unique)
New-Item -ItemType Directory -Path $BatchDirectory | Out-Null
$DesktopSlot = 'Hwanghon_Automation_' + $Unique + '_desktop'
$Cases = @(
    [pscustomobject]@{ Name = 'desktop-full'; Scenario = 'full'; Width = 1672; Height = 952; Slot = $DesktopSlot },
    [pscustomobject]@{ Name = 'desktop-reload'; Scenario = 'reload'; Width = 1672; Height = 952; Slot = $DesktopSlot },
    [pscustomobject]@{ Name = 'portrait-full'; Scenario = 'full'; Width = 390; Height = 844; Slot = ('Hwanghon_Automation_' + $Unique + '_portrait') },
    [pscustomobject]@{ Name = 'landscape-full'; Scenario = 'full'; Width = 844; Height = 390; Slot = ('Hwanghon_Automation_' + $Unique + '_landscape') }
)
$Results = [Collections.Generic.List[object]]::new()
foreach ($Case in $Cases) {
    $RunDirectory = Join-Path $BatchDirectory $Case.Name
    New-Item -ItemType Directory -Path $RunDirectory | Out-Null
    $StartedUtc = [datetime]::UtcNow
    $Result = [ordered]@{
        Name = $Case.Name; Scenario = $Case.Scenario; Width = $Case.Width; Height = $Case.Height
        ProfileSlot = $Case.Slot; Directory = $RunDirectory; TestSuccess = $false
        StartedUtc = $StartedUtc.ToString('o'); ExitCode = $null; Diagnostic = ''; Validation = $null
    }
    $Process = $null
    try {
        Assert-HWShellCondition ($Case.Slot -cmatch '^Hwanghon_Automation_[A-Za-z0-9_]+$' -and $Case.Slot.Length -le 100) 'Invalid isolated automation slot.'
        if ($Case.Scenario -ceq 'reload' -and !$Results[0].TestSuccess) {
            throw 'Reload skipped because desktop-full did not establish a verified persisted clear.'
        }
        $Arguments = @(
            $Project, '/Game/Maps/HW_Lobby', '-game', '-RenderOffscreen', '-windowed', '-ForceRes',
            "-ResX=$($Case.Width)", "-ResY=$($Case.Height)", '-unattended', '-nosplash', '-nosound',
            '-NoVSync', '-nop4', '-stdout', '-FullStdOutLogOutput', '-HWShellQA',
            "-HWProfileSlot=$($Case.Slot)", "-HWShellScenario=$($Case.Scenario)", "-HWScreenshotDir=$RunDirectory",
            "-AbsLog=$(Join-Path $RunDirectory 'engine.log')",
            '-ini:Game:[/Script/EngineSettings.GeneralProjectSettings]:MinWindowWidth=1',
            '-ini:Game:[/Script/EngineSettings.GeneralProjectSettings]:MinWindowHeight=1'
        )
        $ArgumentLine = ($Arguments | ForEach-Object { ConvertTo-HWWindowsArgument $_ }) -join ' '
        Write-Host "Shell QA: $($Case.Name) ($($Case.Width)x$($Case.Height)), UE $EngineVersion"
        $Process = Start-Process -FilePath $Editor -ArgumentList $ArgumentLine -WorkingDirectory $ProjectDirectory `
            -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RunDirectory 'stdout.log') `
            -RedirectStandardError (Join-Path $RunDirectory 'stderr.log')
        $Deadline = [datetime]::UtcNow.AddSeconds($ProcessTimeoutSeconds)
        while (!$Process.WaitForExit(1000)) {
            if ([datetime]::UtcNow -ge $Deadline) {
                # This is exactly the QA process started above, not an editor found
                # by a broad process-name search.
                Stop-Process -Id $Process.Id -Force
                throw "Engine process exceeded the $ProcessTimeoutSeconds-second startup/runtime limit."
            }
        }
        $Process.WaitForExit()
        $Process.Refresh()
        $Result.ExitCode = $Process.ExitCode
        $Result.Validation = Assert-HWShellReport -RunDirectory $RunDirectory -StartedUtc $StartedUtc `
            -Scenario $Case.Scenario -Slot $Case.Slot -Width $Case.Width -Height $Case.Height
        Assert-HWShellCondition ($Process.ExitCode -eq 0) "Engine exited with status $($Process.ExitCode)."
        $Result.TestSuccess = $true
        $Result.Diagnostic = 'Runtime JSON, Slate interactions, save counts, PNG dimensions and visible control measurements passed.'
    } catch {
        $Result.Diagnostic = $_.Exception.Message
        Write-Warning "$($Case.Name): $($Result.Diagnostic)"
    } finally {
        if ($null -ne $Process) { $Process.Dispose() }
    }
    $Results.Add([pscustomobject]$Result)
}
$Failed = @($Results | Where-Object { !$_.TestSuccess }).Count
$Aggregate = [pscustomobject][ordered]@{
    TestSuccess = ($Failed -eq 0 -and $Results.Count -eq 4)
    EngineVersion = $EngineVersion; ProjectTargetEngine = $TargetVersion
    DiagnosticOnly = !$EngineMatches; TargetEngineVersionMatched = $EngineMatches
    AndroidDeviceValidated = $false
    Scope = 'Native Windows offscreen runtime QA with Slate pointer routing and paused abandon-confirmation/cancel/return checks; scripted position and lethal damage are disclosed in each runtime report.'
    ReportDirectory = $BatchDirectory
    Passed = $Results.Count - $Failed; Failed = $Failed; Runs = @($Results.ToArray())
}
$AggregatePath = Join-Path $BatchDirectory 'shell-qa-aggregate.json'
$Aggregate | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $AggregatePath -Encoding UTF8
Write-Host "Shell QA aggregate: $AggregatePath"
Write-Output $Aggregate
if (!$Aggregate.TestSuccess) { throw "$Failed shell QA run(s) failed; see $AggregatePath" }
