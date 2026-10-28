param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$mapping = Get-Content -LiteralPath (Join-Path $Root 'PPT/decks.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$files = @(Get-ChildItem -LiteralPath (Join-Path $Root 'PPT') -File | Where-Object { $_.Extension -ieq '.pptx' })
$resolved = [ordered]@{}
foreach ($property in $mapping.PSObject.Properties) {
  $prefix = [System.IO.Path]::GetFileNameWithoutExtension($property.Value)
  $matchesForSlot = @($files | Where-Object { $_.BaseName -ieq $prefix -or $_.BaseName.StartsWith($prefix + '_', [System.StringComparison]::OrdinalIgnoreCase) })
  if ($matchesForSlot.Count -ne 1) { throw ('Expected one PPT for ' + $property.Value + '; found ' + $matchesForSlot.Count + ': ' + (($matchesForSlot | ForEach-Object Name) -join ', ')) }
  $resolved[$property.Name] = $matchesForSlot[0].Name
}
$mapping = [pscustomobject]$resolved
$manifestPath = Join-Path $Root 'PPT/manifest.json'
$previous = if (Test-Path -LiteralPath $manifestPath) { Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { [pscustomobject]@{} }
$hadPowerPoint = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$app = $null
$manifest = @{}
try {
  foreach ($property in $mapping.PSObject.Properties) {
    $key = $property.Name
    $source = Join-Path $Root ('PPT/' + $property.Value)
    $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLower()
    $old = $previous.PSObject.Properties[$key]
    if ($old -and $old.Value.sha256 -eq $hash -and $old.Value.slides.Count -gt 0 -and @($old.Value.slides | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root ('PPT/' + $_))) }).Count -eq 0) {
      $manifest[$key] = @{source=$property.Value;sha256=$hash;slides=$old.Value.slides}
      Write-Output ($key + ': cached ' + $old.Value.slides.Count + ' slides')
      continue
    }
    if (-not $app) { $app = New-Object -ComObject PowerPoint.Application }
    $dest = Join-Path $Root ('PPT/rendered/' + $key + '/' + $hash.Substring(0,12))
    New-Item -ItemType Directory -Force $dest | Out-Null
    $deck = $app.Presentations.Open($source, $true, $false, $false)
    try {
      $slides = @()
      for ($i=1; $i -le $deck.Slides.Count; $i++) {
        $name = 'slide-' + $i.ToString('000') + '.jpg'
        $deck.Slides.Item($i).Export((Join-Path $dest $name), 'JPG', 3840, [int](3840*$deck.PageSetup.SlideHeight/$deck.PageSetup.SlideWidth))
        $slides += 'rendered/' + $key + '/' + $hash.Substring(0,12) + '/' + $name
      }
      $manifest[$key] = @{source=$property.Value;sha256=$hash;slides=$slides}
    } finally { $deck.Close() }
    Write-Output ($key + ': ' + $slides.Count + ' slides')
  }
  $json = ($manifest | ConvertTo-Json -Depth 6) -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))
} finally { if ($app -and -not $hadPowerPoint -and $app.Presentations.Count -eq 0) { $app.Quit() } }
