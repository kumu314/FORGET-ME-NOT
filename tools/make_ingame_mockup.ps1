# ============================================================
# In-game mockup: stage1 morning playground
# parallax 4 layers + corridor tiles + member-A player & dog
# Output: tools/_style_ref/out/ingame_mockup_stage1.png (+x4)
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root  = Split-Path -Parent $PSScriptRoot
$psx   = Join-Path $root "game\public\assets\parallax"
$tsDir = Join-Path $root "game\public\assets\tilesets"
$ref   = Join-Path $root "tools\_style_ref"
$outD  = Join-Path $ref "out"

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class Gen4 {
  public static Px LoadPx(string path){
    Px p=null;
    using(Bitmap b=new Bitmap(path)){
      p=new Px(b.Width,b.Height);
      for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++){
        Color c=b.GetPixel(x,y); p.c[x,y]=Color.FromArgb(c.A,c.R,c.G,c.B);
      }
    }
    return p;
  }
  public static Px Crop(Px s,int x,int y,int w,int h){
    Px p=new Px(w,h);
    for(int j=0;j<h;j++) for(int i=0;i<w;i++) p.c[i,j]=s.c[x+i,y+j];
    return p;
  }
  public static void Blit(Px d,Px s,int ox,int oy){
    for(int y=0;y<s.H;y++) for(int x=0;x<s.W;x++){
      Color c=s.c[x,y];
      if(c.A>0 && d.In(ox+x,oy+y)) d.c[ox+x,oy+y]=c;
    }
  }
  public static Px Scale(Px p,int f){
    Px o=new Px(p.W*f,p.H*f);
    for(int y=0;y<o.H;y++) for(int x=0;x<o.W;x++) o.c[x,y]=p.c[x/f,y/f];
    return o;
  }
  public static void SavePx(Px p,string path){
    using(Bitmap b=new Bitmap(p.W,p.H,PixelFormat.Format32bppArgb)){
      for(int y=0;y<p.H;y++) for(int x=0;x<p.W;x++) b.SetPixel(x,y,p.c[x,y]);
      b.Save(path,ImageFormat.Png);
    }
  }
  public class Px {
    public int W,H; public Color[,] c;
    public Px(int w,int h){ W=w;H=h; c=new Color[w,h];
      Color t=Color.FromArgb(0,0,0,0);
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) c[x,y]=t; }
    public bool In(int x,int y){ return x>=0&&y>=0&&x<W&&y<H; }
  }
}
"@
Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- load parallax layers ----
$sky  = [Gen4]::LoadPx((Join-Path $psx "stage1_morning_sky.png"))
$far  = [Gen4]::LoadPx((Join-Path $psx "stage1_morning_far.png"))
$mid  = [Gen4]::LoadPx((Join-Path $psx "stage1_morning_mid.png"))
$near = [Gen4]::LoadPx((Join-Path $psx "stage1_morning_near.png"))

# ---- load tile sheets + frame coords ----
$sheet  = [Gen4]::LoadPx((Join-Path $tsDir "school_corridor.png"))
$eggs   = [Gen4]::LoadPx((Join-Path $tsDir "easter_eggs.png"))
$a1 = (Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$a2 = (Get-Content (Join-Path $tsDir "easter_eggs.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
function Frame-Of($frames,[string]$name,$sheetPx){
  foreach($f in $frames){ if($f.filename -eq $name){ return [Gen4]::Crop($sheetPx,$f.frame.x,$f.frame.y,16,16) } }
  throw "frame not found: $name"
}
$tFloorEdge = Frame-Of $a1 "floor_edge"  $sheet
$tFloorA    = Frame-Of $a1 "floor_a"     $sheet
$tFloorB    = Frame-Of $a1 "floor_b"     $sheet
$tPlant     = Frame-Of $a1 "plant"       $sheet
$tBin       = Frame-Of $a1 "trash_bin"   $sheet
$tScrap     = Frame-Of $a1 "paper_scrap" $sheet
$tChalk     = Frame-Of $a1 "chalk_dust"  $sheet
$tBox       = Frame-Of $a2 "box_tremble_a" $eggs
$tBubble    = Frame-Of $a2 "bubble_wuu"    $eggs

# ---- characters (member A) ----
$playerSheet = [Gen4]::LoadPx((Join-Path $ref "player_youth.png"))
$player = [Gen4]::Crop($playerSheet, 0, 0, 24, 24)      # idle frame 0
$dogSheet = [Gen4]::LoadPx((Join-Path $ref "dog_puppy.png"))
$dog = [Gen4]::Crop($dogSheet, 0, 0, 12, 12)            # idle frame 0

# ---- compose 320x180 ----
$S = New-Object Gen4+Px 320,180
[Gen4]::Blit($S,$sky,0,0)
[Gen4]::Blit($S,$far,0,0)
[Gen4]::Blit($S,$mid,0,0)
[Gen4]::Blit($S,$near,0,0)

# ground rows (top y=148)
for($c=0;$c -lt 20;$c++){
  $edge=[Gen4]::Blit($S,$tFloorEdge,($c*16),148)
  $t=$tFloorA; if(($c % 3) -eq 2){ $t=$tFloorB }
  [Gen4]::Blit($S,$t,($c*16),164)
}
# props standing on ground line
[Gen4]::Blit($S,$tPlant,  6,132)
[Gen4]::Blit($S,$tBin,  282,132)
[Gen4]::Blit($S,$tChalk,118,140)
[Gen4]::Blit($S,$tScrap,196,140)
# easter egg box + whimper bubble
[Gen4]::Blit($S,$tBox,  294,132)
[Gen4]::Blit($S,$tBubble,298,114)
# companion dog behind player (player faces right)
[Gen4]::Blit($S,$dog, 122,136)
# player idle
[Gen4]::Blit($S,$player,148,124)

[Gen4]::SavePx($S,(Join-Path $outD "ingame_mockup_stage1.png"))
[Gen4]::SavePx([Gen4]::Scale($S,4),(Join-Path $outD "ingame_mockup_stage1_x4.png"))
Write-Host "MOCKUP OK"
