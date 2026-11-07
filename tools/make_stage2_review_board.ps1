# Stage-2 full asset review board (office tiles + rainy night parallax). ASCII only.
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

$g.DrawString("FORGET-ME-NOT - Stage 2 asset review board (member B)",$fT,$bW,24,10)

Sec "1) tiles: office_rain.png  (34 tiles, 16x16) x4" 44
Draw-Img (Join-Path $ts "preview\office_rain_sheet_x4.png") 48 78 1024 1024

Sec "2) parallax: rainy night (sky / far / mid / near / rain-overlay) + composite" 1116
Draw-Img (Join-Path $psx "stage2_night_sky.png")     24 1160 160 90
Draw-Img (Join-Path $psx "stage2_night_far.png")    196 1160 160 90
Draw-Img (Join-Path $psx "stage2_night_mid.png")    368 1160 160 90
Draw-Img (Join-Path $psx "stage2_night_near.png")   540 1160 160 90
Draw-Img (Join-Path $psx "stage2_rain_overlay.png") 712 1160 160 90
Draw-Img (Join-Path $psx "preview\mockup_stage2_night_x3.png") 320 1270 480 270

$g.Dispose()
$outPath = Join-Path $outD "stage2_review_board.png"
$bmp.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("OK -> " + $outPath)
