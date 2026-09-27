param([string]$ValidatorPath = (Join-Path $PSScriptRoot '..\build_validation.ps1'))
$ErrorActionPreference = 'Stop'
. $ValidatorPath

$TempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$TempDir = Join-Path $TempParent ('hwanghon-build-validation-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TempDir | Out-Null
$ReportPath = Join-Path $TempDir 'index.json'
$Started = [datetime]::UtcNow.AddMinutes(-1)
$script:Checks = 0

function Assert-Equal($Actual, $Expected, [string]$Label) {
    if ($Actual -ne $Expected) { throw "$Label : expected $Expected, got $Actual" }
    $script:Checks++
}

function Assert-Rejected([scriptblock]$Action, [string]$Label, [string]$Message = '') {
    $Thrown = $null
    try { & $Action | Out-Null } catch { $Thrown = $_.Exception.Message }
    if ($null -eq $Thrown) { throw "Expected rejection: $Label" }
    if ($Message -and $Thrown -notlike "*$Message*") { throw "$Label : unexpected error: $Thrown" }
    $script:Checks++
}

function New-ValidReport {
    return @{
        succeeded = 2; succeededWithWarnings = 0; failed = 0; notRun = 0; inProcess = 0
        tests = @(
            @{ fullTestPath = 'Hwanghon.Combat.PlayerTimingDefaults'; state = 'Success'; errors = 0; warnings = 0; entries = @() },
            @{ fullTestPath = 'Hwanghon.Progression.ClearLedger'; state = 'Success'; errors = 0; warnings = 0; entries = @() }
        )
    }
}

function Write-Report($Report) {
    $Report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
}

function Validate-Report {
    Assert-HWAutomationReport -ReportDir $TempDir -RunStartedUtc $Started
}

try {
    Assert-Rejected { Validate-Report } 'missing report' 'report missing'
    $NestedDir = Join-Path $TempDir 'old run [archive]'
    New-Item -ItemType Directory -Path $NestedDir | Out-Null
    New-ValidReport | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $NestedDir 'index.json') -Encoding UTF8
    Assert-Rejected { Validate-Report } 'nested old report cannot replace missing root report' 'report missing'
    Assert-Equal (Assert-HWAutomationReport -ReportDir $NestedDir -RunStartedUtc $Started).Passed 2 'literal report path with spaces and brackets'
    Write-Report (New-ValidReport)
    Assert-Equal (Validate-Report).Passed 2 'successful suites'

    $Report = New-ValidReport
    $Report.succeeded = 1
    $Report.succeededWithWarnings = 1
    $Report.tests[1].warnings = 2
    Write-Report $Report
    Assert-Equal (Validate-Report).SucceededWithWarnings 1 'successful with warnings'

    '{broken json' | Set-Content -LiteralPath $ReportPath
    Assert-Rejected { Validate-Report } 'malformed JSON'
    'null' | Set-Content -LiteralPath $ReportPath
    Assert-Rejected { Validate-Report } 'null JSON' 'JSON object'
    '[]' | Set-Content -LiteralPath $ReportPath
    Assert-Rejected { Validate-Report } 'array JSON' 'JSON object'
    Write-Report @{}
    Assert-Rejected { Validate-Report } 'missing counts' 'non-negative integer'

    foreach ($Counter in @('failed', 'notRun', 'inProcess')) {
        $Report = New-ValidReport
        $Report[$Counter] = 1
        Write-Report $Report
        Assert-Rejected { Validate-Report } "non-zero $Counter" 'did not pass'
    }
    $Report = New-ValidReport
    $Report.succeeded = -1
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'negative count' 'non-negative integer'
    $Report.succeeded = '2'
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'string count' 'non-negative integer'
    $Report.succeeded = 1.5
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'fractional count' 'non-negative integer'

    $Report = New-ValidReport
    $Report.succeeded = 0
    $Report.tests = @()
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'zero tests' 'zero tests'
    $Report = New-ValidReport
    $Report.succeeded = 3
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'summary count mismatch' 'inconsistent'
    $Report = New-ValidReport
    $Report.tests = $Report.tests[0]
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'non-array tests' 'must be an array'

    foreach ($State in @('Fail', 'NotRun', 'InProcess', 'Skipped', 'Unknown', '')) {
        $Report = New-ValidReport
        $Report.tests[1].state = $State
        Write-Report $Report
        Assert-Rejected { Validate-Report } "failed row masked by green summary ($State)" 'did not succeed'
    }
    $Report = New-ValidReport
    $Report.tests[1].errors = 1
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'success row with errors' 'contains errors'
    $Report = New-ValidReport
    $Report.tests[1].Remove('errors')
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'missing row errors' 'non-negative integer'
    $Report = New-ValidReport
    $Report.tests[1].entries = @(@{ event = @{ type = 'Error'; message = 'failed assert' } })
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'error event masked by count' 'error event'
    $Report = New-ValidReport
    $Report.tests[1].warnings = 1
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'warning count mismatch' 'warning counts'

    foreach ($Path in @('', 'Other.Combat.PlayerTimingDefaults', 'hwanghon.Progression.ClearLedger', 'Hwanghon.', $null)) {
        $Report = New-ValidReport
        $Report.tests[1].fullTestPath = $Path
        Write-Report $Report
        Assert-Rejected { Validate-Report } "invalid path '$Path'" 'test path'
    }
    $Report = New-ValidReport
    $Report.tests[1].fullTestPath = $Report.tests[0].fullTestPath
    Write-Report $Report
    Assert-Rejected { Validate-Report } 'duplicate path' 'duplicate'
    foreach ($MissingSuite in @('Combat', 'Progression')) {
        $Report = New-ValidReport
        $Report.tests = @($Report.tests | Where-Object { $_.fullTestPath -notlike "Hwanghon.$MissingSuite.*" })
        $Report.succeeded = 1
        Write-Report $Report
        Assert-Rejected { Validate-Report } "missing $MissingSuite suite" 'Required automation suite'
    }
    Write-Report (New-ValidReport)
    (Get-Item -LiteralPath $ReportPath).LastWriteTimeUtc = $Started.AddSeconds(-1)
    Assert-Rejected { Validate-Report } 'stale report' 'stale'

    $FakeEngine = Join-Path $TempDir 'Engine\Build'
    New-Item -ItemType Directory -Path $FakeEngine -Force | Out-Null
    $VersionPath = Join-Path $FakeEngine 'Build.version'
    $ProjectPath = Join-Path $TempDir 'sample.uproject'
    '{"EngineAssociation":"5.5"}' | Set-Content -LiteralPath $ProjectPath
    Assert-Rejected { Assert-HWEngineVersion $TempDir $ProjectPath } 'missing Build.version' 'version file not found'
    '{"MajorVersion":5,"MinorVersion":5,"PatchVersion":4}' | Set-Content -LiteralPath $VersionPath
    Assert-Equal (Assert-HWEngineVersion $TempDir $ProjectPath) '5.5.4' 'compatible 5.5 patch'
    '{"MajorVersion":5,"MinorVersion":8,"PatchVersion":1}' | Set-Content -LiteralPath $VersionPath
    Assert-Rejected { Assert-HWEngineVersion $TempDir $ProjectPath } 'wrong engine version' 'requires 5.5, selected engine is 5.8.1'
    '{"MajorVersion":5,"MinorVersion":"5","PatchVersion":0}' | Set-Content -LiteralPath $VersionPath
    Assert-Rejected { Assert-HWEngineVersion $TempDir $ProjectPath } 'malformed version number' 'non-negative integer'
    '{"EngineAssociation":"{some-source-guid}"}' | Set-Content -LiteralPath $ProjectPath
    Assert-Rejected { Assert-HWEngineVersion $TempDir $ProjectPath } 'unsupported association' 'numeric EngineAssociation'
    '{"EngineAssociation":"5.5.1"}' | Set-Content -LiteralPath $ProjectPath
    '{"MajorVersion":5,"MinorVersion":5,"PatchVersion":2}' | Set-Content -LiteralPath $VersionPath
    Assert-Rejected { Assert-HWEngineVersion $TempDir $ProjectPath } 'explicit patch mismatch' 'version mismatch'
    Write-Output "PASS: $script:Checks build validation checks"
} finally {
    $ResolvedTemp = [IO.Path]::GetFullPath($TempDir)
    if ([IO.Path]::GetDirectoryName($ResolvedTemp).TrimEnd('\', '/') -ne $TempParent.TrimEnd('\', '/') -or
        [IO.Path]::GetFileName($ResolvedTemp) -notlike 'hwanghon-build-validation-*') {
        throw "Refusing to clean an unexpected fixture directory: $ResolvedTemp"
    }
    Remove-Item -LiteralPath $ResolvedTemp -Recurse -Force
}
