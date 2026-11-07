# ============================================================
# Stage-1 full asset review board (one image, labeled sections)
# Output: tools/_style_ref/out/stage1_review_board.png
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$ts   = Join-Path $root "game\public\assets\tilesets"
$psx  = Join-Path $root "game\public\assets\parallax"
$outD = Join-Path $root "tools\_style_ref\out"

$W = 1120
$H = 2220
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#252B42"))

$fT = New-Object System.Drawing.Font ("Microsoft YaHei UI", 15, [System.Drawing.FontStyle]::Bold)
$fS = New-Object System.Drawing.Font ("Consolas", 11, [System.Drawing.FontStyle]::Regular)
$bW = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F6F3EB"))
$bG = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FFD9A0"))

function Draw-Img([string]$path,[int]$x,[int]$y,[int]$w,[int]$h){
  $img=[System.Drawing.Image]::FromFile($path)
  $r=New-Object System.Drawing.Rectangle $x,$y,$w,$h
  $g.DrawImage($img,$r,0,0,$img.Width,$img.Height,[System.Drawing.GraphicsUnit]::Pixel)
  $img.Dispose()
}
function Sec([string]$txt,[int]$y){
  $g.DrawString($txt,$fT,$bG,24,$y)
}

$g.DrawString("FORGET-ME-NOT - Stage 1 asset review board (member B)",$fT,$bW,24,10)

Sec "1) tiles: school_corridor.png  (43 tiles, 16x16) x4" 44
Draw-Img (Join-Path $ts "preview\school_corridor_sheet_x4.png") 48 78 1024 1024

Sec "2) easter eggs: easter_eggs.png  (9 sprites, 16x16) x4" 1116
Draw-Img (Join-Path $ts "preview\easter_eggs_sheet_x4.png") 272 1152 576 64

Sec "3) props: school_props.png  (door 24x44 / lockers 32x40 / window 32x32 / bulletin 32x24) x6" 1264
Draw-Img (Join-Path $ts "preview\school_props_sheet_x6.png") 176 1304 768 288

Sec "4) outdoor parallax: morning (sky / far / mid / near + composite)" 1608
Draw-Img (Join-Path $psx "stage1_morning_sky.png")  24 1690 160 90
Draw-Img (Join-Path $psx "stage1_morning_far.png") 196 1690 160 90
Draw-Img (Join-Path $psx "stage1_morning_mid.png") 368 1690 160 90
Draw-Img (Join-Path $psx "stage1_morning_near.png")540 1690 160 90
Draw-Img (Join-Path $psx "preview\mockup_stage1_morning_x3.png") 620 1644 480 270

Sec "5) indoor parallax: plain warm (sky / far / mid / near + composite)" 1930
Draw-Img (Join-Path $psx "stage1_indoor_sky.png")  24 2012 160 90
Draw-Img (Join-Path $psx "stage1_indoor_far.png") 196 2012 160 90
Draw-Img (Join-Path $psx "stage1_indoor_mid.png") 368 2012 160 90
Draw-Img (Join-Path $psx "stage1_indoor_near.png")540 2012 160 90
Draw-Img (Join-Path $psx "preview\mockup_stage1_indoor_x3.png") 620 1966 480 270

$g.Dispose()
$outPath = Join-Path $outD "stage1_review_board.png"
$bmp.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("OK -> " + $outPath)
