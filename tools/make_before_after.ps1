# ============================================================
# Before/after comparison for style batch 1 (4 tiles).
# OLD = cropped from committed school_corridor.png (via JSON frames)
# NEW = tools/_style_ref/out/tile_*.png
# Output: tools/_style_ref/out/before_after_batch1.png
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$tsDir = Join-Path $root "game\public\assets\tilesets"
$outDir = Join-Path $root "tools\_style_ref\out"

$names = @(
  @{key="wall_upper"; cn="wall / wall_upper"},
  @{key="floor_a";    cn="floor / floor_a"},
  @{key="desk_mid";   cn="desk / desk_mid"},
  @{key="window";     cn="window / window"}
)

# ---- frame coords from committed JSON ----
$atlas = Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$coord = @{}
foreach($f in $atlas.frames){ $coord[$f.filename] = @{ x=$f.frame.x; y=$f.frame.y } }

$sheet = [System.Drawing.Image]::FromFile((Join-Path $tsDir "school_corridor.png"))

$z = 8                 # zoom
$cell = 16 * $z        # 128
$gap = 14
$leftW = 200
$topH = 46
$margin = 18
$W = $margin + $leftW + $cell + $gap + $cell + $margin
$H = $topH + $margin + 4*($cell + $gap) + $margin + 26

$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

# bg
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#252B42"))

$fontH = New-Object System.Drawing.Font ("Microsoft YaHei UI", 13, [System.Drawing.FontStyle]::Bold)
$fontN = New-Object System.Drawing.Font ("Consolas", 11, [System.Drawing.FontStyle]::Regular)
$brushW = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F6F3EB"))
$brushO = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#9AA3B8"))
$brushG = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FFD9A0"))

# column headers
$hY = 14
$g.DrawString("OLD", $fontH, $brushO, ($margin + $leftW + 44), $hY)
$g.DrawString("NEW", $fontH, $brushG, ($margin + $leftW + $cell + $gap + 44), $hY)
$g.DrawString("old (develop)", $fontN, $brushO, ($margin + $leftW + 22), ($hY + 24))
$g.DrawString("new (dusk)", $fontN, $brushG, ($margin + $leftW + $cell + $gap + 26), ($hY + 24))

$row = 0
foreach($n in $names){
  $y = $topH + $margin + $row * ($cell + $gap)
  # row label
  $g.DrawString($n.cn, $fontN, $brushW, $margin, ($y + 52))
  # OLD cell
  $c = $coord[$n.key]
  $dstRect = New-Object System.Drawing.Rectangle ($margin + $leftW), $y, $cell, $cell
  $srcRect = New-Object System.Drawing.Rectangle $c.x, $c.y, 16, 16
  $g.DrawImage($sheet, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  # NEW cell
  $newImg = [System.Drawing.Image]::FromFile((Join-Path $outDir ($n.key + ".png")))
  $dstRect2 = New-Object System.Drawing.Rectangle ($margin + $leftW + $cell + $gap), $y, $cell, $cell
  $srcRect2 = New-Object System.Drawing.Rectangle 0, 0, 16, 16
  $g.DrawImage($newImg, $dstRect2, $srcRect2, [System.Drawing.GraphicsUnit]::Pixel)
  $newImg.Dispose()
  $row++
}

# footer note
$g.DrawString("#101320 outline / cool shadows / #FFD9A0 window only", $fontN, $brushO, $margin, ($H - 30))

$g.Dispose()
$outPath = Join-Path $outDir "before_after_batch1.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$sheet.Dispose()
Write-Host ("OK -> " + $outPath)
