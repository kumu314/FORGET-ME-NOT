# ============================================================
# school_props tileset (multi-size decoration sprites)
#   door_classroom 24x80 | lockers 32x64 | window_big 32x48 | bulletin 32x24
# Output:
#   game/public/assets/tilesets/school_props.png (+ json, arbitrary frame sizes)
#   tools/_style_ref/out/ingame_mockup_stage1_indoor_props_x4.png
# Style: Stardew-warm, matches indoor parallax palette. Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tsDir= Join-Path $root "game\public\assets\tilesets"
$psx  = Join-Path $root "game\public\assets\parallax"
$ref  = Join-Path $root "tools\_style_ref"
$outD = Join-Path $ref "out"

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class Gen6 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
  public class Px {
    public int W,H; public Color[,] c;
    public Px(int w,int h){ W=w;H=h; c=new Color[w,h];
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) c[x,y]=Color.FromArgb(0,0,0,0); }
    public bool In(int x,int y){ return x>=0&&y>=0&&x<W&&y<H; }
    public void P(int x,int y,Color col){ if(In(x,y)) c[x,y]=col; }
    public void R(int x,int y,int w,int h,Color col){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,col); }
    public void HL(int x,int y,int w,Color col){ R(x,y,w,1,col); }
    public void V(int x,int y,int h,Color col){ R(x,y,1,h,col); }
    public void Frame(int x,int y,int w,int h,Color col){
      HL(x,y,w,col); HL(x,y+h-1,w,col); V(x,y,h,col); V(x+w-1,y,h,col); }
    public void Dith(int x,int y,int w,int h,Color a,Color b){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,((i+j)&1)==0?a:b); }
  }
  public static void Blit(Px d,Px s,int ox,int oy){
    for(int y=0;y<s.H;y++) for(int x=0;x<s.W;x++){
      Color c=s.c[x,y];
      if(c.A>0 && d.In(ox+x,oy+y)) d.c[ox+x,oy+y]=c;
    }
  }
  public static void BlendBlit(Px d,Px s,int ox,int oy){
    for(int y=0;y<s.H;y++) for(int x=0;x<s.W;x++){
      Color sc=s.c[x,y]; int dx=ox+x, dy=oy+y;
      if(sc.A<=0 || !d.In(dx,dy)) continue;
      Color dc=d.c[dx,dy]; double a=sc.A/255.0;
      int r=(int)Math.Round(sc.R*a+dc.R*(1-a));
      int g=(int)Math.Round(sc.G*a+dc.G*(1-a));
      int b=(int)Math.Round(sc.B*a+dc.B*(1-a));
      d.c[dx,dy]=Color.FromArgb(255,r,g,b);
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
}

public static class Props {
  // classroom door 24x44 (floor-standing, ~1.8x player height)
  public static Gen6.Px Door(){
    Gen6.Px p=new Gen6.Px(24,44);
    p.R(0,0,24,44, Gen6.From("#C9A26A"));
    p.V(0,0,44, Gen6.From("#D8B078"));
    p.V(22,0,2, Gen6.From("#B08E58"));
    p.Frame(3,4,18,16, Gen6.From("#A8804E"));    // upper panel
    p.R(4,24,16,8, Gen6.From("#FFF3D6"));        // door glass slit
    p.Frame(3,23,18,10, Gen6.From("#A8804E"));
    p.R(18,33,3,4, Gen6.From("#6E5638"));        // handle
    p.R(0,38,24,6, Gen6.From("#9A7A4E"));        // base
    return p;
  }
  // locker pair 32x40 (floor-standing, ~1.7x player height)
  public static Gen6.Px Lockers(){
    Gen6.Px p=new Gen6.Px(32,40);
    p.R(0,0,32,40, Gen6.From("#D8AC72"));
    p.V(0,0,40, Gen6.From("#E4BC84"));
    p.V(30,0,2, Gen6.From("#C2955C"));
    p.V(15,0,40, Gen6.From("#CB9E64"));      // pair gap
    for(int v=0;v<2;v++){
      p.HL(4,7+v*6,9, Gen6.From("#B8854E"));
      p.HL(18,7+v*6,9, Gen6.From("#B8854E"));
    }
    p.R(11,22,2,5, Gen6.From("#8A6238"));
    p.R(25,22,2,5, Gen6.From("#8A6238"));
    p.R(0,34,32,6, Gen6.From("#B8854E"));    // base
    return p;
  }
  // square window 32x32 (wall-mounted, 4 panes)
  public static Gen6.Px WindowBig(){
    Gen6.Px p=new Gen6.Px(32,32);
    p.R(0,0,32,32, Gen6.From("#8A6A44"));
    p.R(3,3,26,26, Gen6.From("#FFD9A0"));
    p.R(3,3,26,9, Gen6.From("#FFF8E2"));
    p.R(3,12,26,8, Gen6.From("#FFEFC8"));
    p.R(15,3,2,26, Gen6.From("#8A6A44"));    // muntin vertical
    p.R(3,15,26,2, Gen6.From("#8A6A44"));    // muntin horizontal
    return p;
  }
  // bulletin board 32x24 (wall-mounted)
  public static Gen6.Px Bulletin(){
    Gen6.Px p=new Gen6.Px(32,24);
    p.R(0,0,32,24, Gen6.From("#A8804E"));
    p.R(2,2,28,20, Gen6.From("#FBF4DE"));
    p.R(5,5,9,8, Gen6.From("#FFFFFF")); p.P(7,6,Gen6.From("#D85A4A"));
    p.R(17,6,8,7, Gen6.From("#FFF6E2")); p.P(20,7,Gen6.From("#5E8EC0"));
    p.R(5,15,10,5, Gen6.From("#FFF6E2"));
    p.P(13,16,Gen6.From("#5E9E6A"));
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- build prop sheet 128x48 ----
$sheet = New-Object Gen6+Px 128,48
$door  = [Props]::Door()
$lock  = [Props]::Lockers()
$wind  = [Props]::WindowBig()
$bull  = [Props]::Bulletin()
[Gen6]::Blit($sheet,$door, 0,0)
[Gen6]::Blit($sheet,$lock,24,0)
[Gen6]::Blit($sheet,$wind,56,0)
[Gen6]::Blit($sheet,$bull,88,0)
[Gen6]::SavePx($sheet,(Join-Path $tsDir "school_props.png"))

$frames = @(
  '{"filename":"door_classroom","frame":{"x":0,"y":0,"w":24,"h":44},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":24,"h":44},"sourceSize":{"w":24,"h":44},"meta":{"role":"decor","solid":true,"note":"classroom door (~1.8x player), bottom flush with floor top"}}',
  '{"filename":"lockers_pair","frame":{"x":24,"y":0,"w":32,"h":40},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":40},"sourceSize":{"w":32,"h":40},"meta":{"role":"decor","solid":true,"note":"locker pair (~1.7x player), bottom flush with floor top"}}',
  '{"filename":"window_big","frame":{"x":56,"y":0,"w":32,"h":32},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":32},"sourceSize":{"w":32,"h":32},"meta":{"role":"decor","solid":false,"note":"square 4-pane window, mount mid-wall height"}}',
  '{"filename":"bulletin_board","frame":{"x":88,"y":0,"w":32,"h":24},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":24},"sourceSize":{"w":32,"h":24},"meta":{"role":"decor","solid":false,"note":"bulletin board, mount mid-wall height"}}'
)
$json = '{"frames":[' + ($frames -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"school_props.png","format":"RGBA8888","size":{"w":128,"h":48},"scale":"1","version":"1.1"}}'
[System.IO.File]::WriteAllText((Join-Path $tsDir "school_props.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "school_props sheet OK (4 sprites, multi-size)"

# ---- ingame composite: plain indoor bg + prop tiles + floor + chars ----
$sky  = [Gen6]::LoadPx((Join-Path $psx "stage1_indoor_sky.png"))
$far  = [Gen6]::LoadPx((Join-Path $psx "stage1_indoor_far.png"))
$mid  = [Gen6]::LoadPx((Join-Path $psx "stage1_indoor_mid.png"))
$near = [Gen6]::LoadPx((Join-Path $psx "stage1_indoor_near.png"))
$cSheet = [Gen6]::LoadPx((Join-Path $tsDir "school_corridor.png"))
$eggs   = [Gen6]::LoadPx((Join-Path $tsDir "easter_eggs.png"))
$a1 = (Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$a2 = (Get-Content (Join-Path $tsDir "easter_eggs.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
function Frame-Of($frames,[string]$name,$sheetPx){
  foreach($f in $frames){ if($f.filename -eq $name){ return [Gen6]::Crop($sheetPx,$f.frame.x,$f.frame.y,$f.frame.w,$f.frame.h) } }
  throw "frame not found: $name"
}
$tFloorEdge = Frame-Of $a1 "floor_edge"  $cSheet
$tFloorA    = Frame-Of $a1 "floor_a"     $cSheet
$tFloorB    = Frame-Of $a1 "floor_b"     $cSheet
$tPlant     = Frame-Of $a1 "plant"       $cSheet
$tBin       = Frame-Of $a1 "trash_bin"   $cSheet
$tChalk     = Frame-Of $a1 "chalk_dust"  $cSheet
$tBox       = Frame-Of $a2 "box_tremble_a" $eggs
$tBubble    = Frame-Of $a2 "bubble_wuu"    $eggs
$player = [Gen6]::Crop([Gen6]::LoadPx((Join-Path $ref "player_youth.png")), 0,0,24,24)
$dog    = [Gen6]::Crop([Gen6]::LoadPx((Join-Path $ref "dog_puppy.png")),   0,0,12,12)

$S = New-Object Gen6+Px 320,180
[Gen6]::Blit($S,$sky,0,0)
[Gen6]::Blit($S,$far,0,0)
[Gen6]::Blit($S,$mid,20,0)
[Gen6]::Blit($S,$mid,-300,0)
[Gen6]::BlendBlit($S,$near,0,0)
# props from new tileset (bottoms flush with floor y=148; wall props mid-wall)
[Gen6]::Blit($S,$lock, 24,108)    # lockers 32x40 -> 108..148
[Gen6]::Blit($S,$bull,110, 74)    # bulletin 32x24 wall-mounted
[Gen6]::Blit($S,$wind,182, 86)    # window 32x32 wall-mounted
[Gen6]::Blit($S,$door,266,104)    # door 24x44 -> 104..148
# ground
for($c=0;$c -lt 20;$c++){
  [Gen6]::Blit($S,$tFloorEdge,($c*16),148)
  $t=$tFloorA; if(($c % 3) -eq 2){ $t=$tFloorB }
  [Gen6]::Blit($S,$t,($c*16),164)
}
# floor props
[Gen6]::Blit($S,$tPlant, 56,132)
[Gen6]::Blit($S,$tBin,  222,132)
[Gen6]::Blit($S,$tChalk, 58,140)
[Gen6]::Blit($S,$tBox,  144,132)
[Gen6]::Blit($S,$tBubble,148,114)
# characters
[Gen6]::Blit($S,$dog,    96,136)
[Gen6]::Blit($S,$player,116,124)
[Gen6]::SavePx([Gen6]::Scale($S,4), (Join-Path $outD "ingame_mockup_stage1_indoor_props_x4.png"))
[Gen6]::SavePx([Gen6]::Scale($sheet,6), (Join-Path $tsDir "preview\school_props_sheet_x6.png"))
Write-Host "props mockup OK"
