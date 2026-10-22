param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$mapping = @{clock='設計_1.pptx';workshop='製作_1.pptx';library='驗証_1.pptx';lab='模擬_1.pptx'}
$app = New-Object -ComObject PowerPoint.Application
$manifest = @{}
try {
  foreach ($key in $mapping.Keys) {
    $source = Join-Path $Root ('PPT/' + $mapping[$key])
    $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLower()
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
      $manifest[$key] = @{source=$mapping[$key];sha256=$hash;slides=$slides}
    } finally { $deck.Close() }
    Write-Output ($key + ': ' + $slides.Count + ' slides')
  }
  $json = ($manifest | ConvertTo-Json -Depth 6) -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText((Join-Path $Root 'PPT/manifest.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
} finally { $app.Quit() }
