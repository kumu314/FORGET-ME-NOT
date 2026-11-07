# Stage-3 full asset review board (home/autumn tiles + sunset parallax). ASCII only.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$ts   = Join-Path $root "game\public\assets\tilesets"
$psx  = Join-Path $root "game\public\assets\parallax"
$outD = Join-Path $root "tools\_style_ref\out"

$W = 1120
$H = 1600
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#252B42"))

$fT = New-Object System.Drawing.Font ("Microsoft YaHei UI", 15, [System.Drawing.FontStyle]::Bold)
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

$g.DrawString("FORGET-ME-NOT - Stage 3 asset review board (member B)",$fT,$bW,24,10)

Sec "1) tiles: home_autumn.png  (31 tiles, 16x16) x4" 44
Draw-Img (Join-Path $ts "preview\home_autumn_sheet_x4.png") 48 78 1024 1024

Sec "2) parallax: sunset home (sky / far / mid / near) + composite" 1116
Draw-Img (Join-Path $psx "stage3_sunset_sky.png")  24 1160 160 90
Draw-Img (Join-Path $psx "stage3_sunset_far.png") 196 1160 160 90
Draw-Img (Join-Path $psx "stage3_sunset_mid.png") 368 1160 160 90
Draw-Img (Join-Path $psx "stage3_sunset_near.png")540 1160 160 90
Draw-Img (Join-Path $psx "preview\mockup_stage3_sunset_x3.png") 320 1270 480 270

$g.Dispose()
$outPath = Join-Path $outD "stage3_review_board.png"
$bmp.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("OK -> " + $outPath)
