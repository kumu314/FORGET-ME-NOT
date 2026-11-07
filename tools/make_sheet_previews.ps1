# Scale tile sheets x4 with nearest-neighbor for review previews. ASCII only.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$dir = Join-Path (Split-Path -Parent $PSScriptRoot) "game\public\assets\tilesets"
foreach($n in @("office_rain","home_autumn","school_corridor","easter_eggs")){
  $srcPath = Join-Path $dir ($n + ".png")
  $src = [System.Drawing.Image]::FromFile($srcPath)
  $dst = New-Object System.Drawing.Bitmap ($src.Width * 4), ($src.Height * 4)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($src, 0, 0, $dst.Width, $dst.Height)
  $g.Dispose()
  $dst.Save((Join-Path $dir ("preview\" + $n + "_sheet_x4.png")), [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  $src.Dispose()
  Write-Host ($n + " sheet preview OK")
}
