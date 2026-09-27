# Shared, engine-independent validation used by the Windows build and its tests.
# Dot-source this file; it does not launch Unreal or change the project.

function Get-HWJsonCount {
    param([object]$Object, [string]$Name)
    $Property = $Object.PSObject.Properties[$Name]
    if ($null -eq $Property -or
        ($Property.Value -isnot [int] -and $Property.Value -isnot [long]) -or
        $Property.Value -lt 0) {
        throw "Missing or invalid non-negative integer: $Name"
    }
    return [long]$Property.Value
}

function Assert-HWEngineVersion {
    param([string]$UERoot, [string]$Project)
    $VersionPath = Join-Path $UERoot 'Engine\Build\Build.version'
    if (!(Test-Path -LiteralPath $VersionPath -PathType Leaf)) {
        throw "Engine version file not found: $VersionPath"
    }
    $ProjectData = Get-Content -LiteralPath $Project -Raw | ConvertFrom-Json
    $Association = [string]$ProjectData.EngineAssociation
    if ($Association -notmatch '^(\d+)\.(\d+)(?:\.(\d+))?$') {
        throw "Expected a numeric EngineAssociation, found '$Association'."
    }
    $ExpectedMajor = [long]$Matches[1]
    $ExpectedMinor = [long]$Matches[2]
    $ExpectedPatch = $Matches[3]
    $BuildVersion = Get-Content -LiteralPath $VersionPath -Raw | ConvertFrom-Json
    $Major = Get-HWJsonCount $BuildVersion 'MajorVersion'
    $Minor = Get-HWJsonCount $BuildVersion 'MinorVersion'
    $Patch = Get-HWJsonCount $BuildVersion 'PatchVersion'
    if ($Major -ne $ExpectedMajor -or $Minor -ne $ExpectedMinor -or
        ($null -ne $ExpectedPatch -and $Patch -ne [long]$ExpectedPatch)) {
        throw "UE version mismatch: project requires $Association, selected engine is $Major.$Minor.$Patch ($UERoot). Install/select the required engine; do not upgrade this project implicitly."
    }
    return "$Major.$Minor.$Patch"
}

function Assert-HWAutomationReport {
    param(
        [string]$ReportDir,
        [datetime]$RunStartedUtc,
        [string[]]$RequiredSuites = @('Hwanghon.Combat.', 'Hwanghon.Progression.')
    )
    # Read only the report from this run, never search old/nested report folders.
    $ReportPath = Join-Path $ReportDir 'index.json'
    if (!(Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
        throw "Automation report missing: $ReportPath"
    }
    if ((Get-Item -LiteralPath $ReportPath).LastWriteTimeUtc -lt $RunStartedUtc.ToUniversalTime()) {
        throw "Automation report is stale: $ReportPath"
    }
    $Json = Get-Content -LiteralPath $ReportPath -Raw
    # Windows PowerShell 5.1 can unwrap a JSON root array; reject it before parsing.
    if ([string]::IsNullOrWhiteSpace($Json) -or !$Json.TrimStart().StartsWith('{')) {
        throw 'Automation report must be a JSON object.'
    }
    $Report = $Json | ConvertFrom-Json
    if ($null -eq $Report -or $Report -isnot [pscustomobject]) {
        throw 'Automation report must be a JSON object.'
    }
    $Succeeded = Get-HWJsonCount $Report 'succeeded'
    $WarningSuccesses = Get-HWJsonCount $Report 'succeededWithWarnings'
    $Failed = Get-HWJsonCount $Report 'failed'
    $NotRun = Get-HWJsonCount $Report 'notRun'
    $InProcess = Get-HWJsonCount $Report 'inProcess'
    if ($Failed -ne 0 -or $NotRun -ne 0 -or $InProcess -ne 0) {
        throw "Automation did not pass: failed=$Failed, notRun=$NotRun, inProcess=$InProcess."
    }
    $TestsProperty = $Report.PSObject.Properties['tests']
    if ($null -eq $TestsProperty -or $TestsProperty.Value -isnot [array]) {
        throw 'Automation report tests must be an array.'
    }
    $Tests = $TestsProperty.Value
    if ($Tests.Count -eq 0 -or $Succeeded + $WarningSuccesses -ne $Tests.Count) {
        throw 'Automation report has zero tests or inconsistent success counts.'
    }
    $Paths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $RowsWithWarnings = 0
    foreach ($Test in $Tests) {
        if ($null -eq $Test -or $Test -isnot [pscustomobject]) {
            throw 'Invalid automation test entry.'
        }
        $Path = $Test.fullTestPath
        if ($Path -isnot [string] -or !$Path.StartsWith('Hwanghon.', [StringComparison]::Ordinal) -or
            $Path.Length -le 'Hwanghon.'.Length -or !$Paths.Add($Path)) {
            throw "Invalid, unrelated or duplicate automation test path: '$Path'"
        }
        if ($Test.state -cne 'Success') {
            throw "Automation test did not succeed: $Path ($($Test.state))"
        }
        $Errors = Get-HWJsonCount $Test 'errors'
        $Warnings = Get-HWJsonCount $Test 'warnings'
        if ($Errors -ne 0) {
            throw "Automation test contains errors: $Path ($Errors)"
        }
        if ($Warnings -gt 0) { $RowsWithWarnings++ }
        foreach ($Entry in $Test.entries) {
            if ($null -ne $Entry -and $Entry.event.type -eq 'Error') {
                throw "Automation test contains an error event: $Path"
            }
        }
    }
    if ($RowsWithWarnings -ne $WarningSuccesses) {
        throw 'Automation report warning counts do not match test entries.'
    }
    foreach ($Suite in $RequiredSuites) {
        if (!@($Paths | Where-Object { $_.StartsWith($Suite, [StringComparison]::Ordinal) }).Count) {
            throw "Required automation suite did not run: $Suite"
        }
    }
    return [pscustomobject]@{
        Passed = $Tests.Count
        SucceededWithWarnings = $WarningSuccesses
        ReportPath = $ReportPath
    }
}
