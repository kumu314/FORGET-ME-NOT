# ============================================================
# office_props tileset v2 (stage2, non-16 sizes, compact)
#   desk_office 40x16 | crt_computer 22x16 | cctv_camera 24x12 | wall_notices 14x16
# Output: game/public/assets/tilesets/office_props.png (+json) + preview + mockup
# (mockup: no backwall - city view behind, cctv mounted on window mullion)
# Pure ASCII.
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

public static class Gen10 {
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

public static class OProp {
  // compact concrete desk (40x16, bottom = floor, top standable)
  public static Gen10.Px DeskOffice(){
    Gen10.Px p=new Gen10.Px(40,16);
    p.R(0,0,40,3, Gen10.From("#D4D8DC"));
    p.HL(0,0,40, Gen10.From("#E4E8EC"));
    p.HL(0,2,40, Gen10.From("#9CA0A4"));
    p.R(0,3,40,11, Gen10.From("#B4B8BC"));
    p.V(0,3,11, Gen10.From("#9CA0A4"));
    p.V(38,3,2, Gen10.From("#A4A8AC"));
    p.R(0,14,40,2, Gen10.From("#8C9094"));
    p.Dith(5,6,8,3, Gen10.From("#A4A8A0"), Gen10.From("#B4B8BC"));
    p.Dith(19,9,7,3, Gen10.From("#A4A8A0"), Gen10.From("#B4B8BC"));
    p.R(27,5,9,5, Gen10.From("#5E6670"));
    p.Frame(27,5,9,5, Gen10.From("#4E545C"));
    p.P(29,7,Gen10.From("#C8D0D8")); p.P(31,7,Gen10.From("#C8D0D8"));
    p.P(29,9,Gen10.From("#C8D0D8")); p.P(32,9,Gen10.From("#C8D0D8"));
    p.R(4,0,3,2, Gen10.From("#E8E4D8")); p.P(5,0,Gen10.From("#6E4A2E"));
    p.R(11,0,7,1, Gen10.From("#F2EFE4"));
    return p;
  }
  // chunky CRT, screen faces left (22x16)
  public static Gen10.Px CrtComputer(){
    Gen10.Px p=new Gen10.Px(22,16);
    p.R(1,1,20,12, Gen10.From("#6A6048"));
    p.HL(1,1,20, Gen10.From("#847A5E"));
    p.R(17,1,4,12, Gen10.From("#57503C"));
    p.Frame(2,2,9,10, Gen10.From("#3E382C"));
    p.R(3,3,7,8, Gen10.From("#C8BEE8"));
    p.R(3,3,7,3, Gen10.From("#E2D8F4"));
    p.HL(3,6,7, Gen10.From("#A89AC8"));
    p.HL(12,3,6, Gen10.From("#4E4636"));
    p.HL(12,5,6, Gen10.From("#4E4636"));
    p.R(5,13,12,2, Gen10.From("#57503C"));
    p.R(4,15,3,1, Gen10.From("#2E2A22"));
    p.R(15,15,3,1, Gen10.From("#2E2A22"));
    p.P(17,14,Gen10.From("#2E4A8C")); p.P(19,14,Gen10.From("#B03A3A"));
    return p;
  }
  // wall cctv on articulated arm, faces left (24x12)
  public static Gen10.Px CctvCamera(){
    Gen10.Px p=new Gen10.Px(24,12);
    p.R(22,1,2,6, Gen10.From("#5A5750"));
    p.R(16,3,6,2, Gen10.From("#B8B4A8"));
    p.HL(16,3,6, Gen10.From("#D2CEC2"));
    p.R(14,2,3,4, Gen10.From("#8A867C"));
    p.Frame(14,2,3,4, Gen10.From("#5A5750"));
    p.R(10,4,4,2, Gen10.From("#B8B4A8"));
    p.R(3,3,8,7, Gen10.From("#A8A49A"));
    p.HL(3,3,8, Gen10.From("#C0BCB0"));
    p.R(3,9,8,1, Gen10.From("#7A7670"));
    p.R(1,4,2,5, Gen10.From("#2E2C28"));
    p.P(1,5,Gen10.From("#4A4840"));
    p.P(10,4,Gen10.From("#E04040"));
    p.R(5,10,3,1, Gen10.From("#5A5750"));
    return p;
  }
  // two pinned wall notices (14x16)
  public static Gen10.Px WallNotices(){
    Gen10.Px p=new Gen10.Px(14,16);
    p.R(0,1,6,10, Gen10.From("#C8CCD0"));
    p.HL(1,3,4, Gen10.From("#4E545C"));
    p.HL(1,5,4, Gen10.From("#4E545C"));
    p.HL(1,7,3, Gen10.From("#4E545C"));
    p.HL(1,9,4, Gen10.From("#4E545C"));
    p.P(2,2,Gen10.From("#D04040"));
    p.R(8,3,6,12, Gen10.From("#D4D8DC"));
    p.HL(9,5,4, Gen10.From("#4E545C"));
    p.HL(9,7,4, Gen10.From("#4E545C"));
    p.HL(9,9,3, Gen10.From("#4E545C"));
    p.HL(9,11,4, Gen10.From("#4E545C"));
    p.HL(9,13,3, Gen10.From("#4E545C"));
    p.P(10,4,Gen10.From("#D04040"));
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- build sheet 100x16 ----
$sheet = New-Object Gen10+Px 100,16
$desk = [OProp]::DeskOffice()
$crt  = [OProp]::CrtComputer()
$cam  = [OProp]::CctvCamera()
$noti = [OProp]::WallNotices()
[Gen10]::Blit($sheet,$desk,0,0)
[Gen10]::Blit($sheet,$crt,40,0)
[Gen10]::Blit($sheet,$cam,62,0)
[Gen10]::Blit($sheet,$noti,86,0)
[Gen10]::SavePx($sheet,(Join-Path $tsDir "office_props.png"))

$frames = @(
  '{"filename":"desk_office","frame":{"x":0,"y":0,"w":40,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":40,"h":16},"sourceSize":{"w":40,"h":16},"meta":{"role":"platform","solid":true,"note":"compact office desk, bottom flush with floor; top row is standable surface"}}',
  '{"filename":"crt_computer","frame":{"x":40,"y":0,"w":22,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":22,"h":16},"sourceSize":{"w":22,"h":16},"meta":{"role":"decor","solid":false,"note":"chunky CRT, pale-violet glow faces left; place on desk top"}}',
  '{"filename":"cctv_camera","frame":{"x":62,"y":0,"w":24,"h":12},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":24,"h":12},"sourceSize":{"w":24,"h":12},"meta":{"role":"decor","solid":false,"note":"wall cctv on articulated arm, faces left, red rec LED; mount plate at right edge - align to window mullion"}}',
  '{"filename":"wall_notices","frame":{"x":86,"y":0,"w":14,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":14,"h":16},"sourceSize":{"w":14,"h":16},"meta":{"role":"decor","solid":false,"note":"two pinned notices, mount on wall or mullion"}}'
)
$json = '{"frames":[' + ($frames -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"office_props.png","format":"RGBA8888","size":{"w":100,"h":16},"scale":"1","version":"1.1"}}'
[System.IO.File]::WriteAllText((Join-Path $tsDir "office_props.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "office_props sheet v2 OK (4 compact sprites)"

# ---- x4 preview ----
$prev = New-Object Gen10+Px 400, 64
for($y=0;$y -lt $prev.H;$y++){ for($x=0;$x -lt $prev.W;$x++){ $prev.c[$x,$y]=[Gen10]::From("#252B42") } }
[Gen10]::Blit($prev,[Gen10]::Scale($desk,4),0,0)
[Gen10]::Blit($prev,[Gen10]::Scale($crt,4),160,0)
[Gen10]::Blit($prev,[Gen10]::Scale($cam,4),248,0)
[Gen10]::Blit($prev,[Gen10]::Scale($noti,4),344,0)
[Gen10]::SavePx($prev,(Join-Path $tsDir "preview\office_props_sheet_x4.png"))

# ---- ingame composite: NO backwall, city view + props, cctv on mullion ----
$sky  = [Gen10]::LoadPx((Join-Path $psx "stage2_night_sky.png"))
$far  = [Gen10]::LoadPx((Join-Path $psx "stage2_night_far.png"))
$mid  = [Gen10]::LoadPx((Join-Path $psx "stage2_night_mid.png"))
$near = [Gen10]::LoadPx((Join-Path $psx "stage2_night_near.png"))
$rain = [Gen10]::LoadPx((Join-Path $psx "stage2_rain_overlay.png"))
$osheet = [Gen10]::LoadPx((Join-Path $tsDir "office_rain.png"))
$ofr = (Get-Content (Join-Path $tsDir "office_rain.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$cache=@{}
function OF([string]$name){
  if(-not $cache.ContainsKey($name)){
    foreach($f in $ofr){ if($f.filename -eq $name){ $cache[$name]=[Gen10]::Crop($osheet,$f.frame.x,$f.frame.y,16,16); break } }
  }
  return $cache[$name]
}
$player = [Gen10]::Crop([Gen10]::LoadPx((Join-Path $ref "player_youth.png")), 0,0,24,24)

$S = New-Object Gen10+Px 320,180
[Gen10]::Blit($S,$sky,0,0)
[Gen10]::Blit($S,$far,0,0)
[Gen10]::Blit($S,$mid,0,0)
[Gen10]::Blit($S,$near,0,0)
# floor only (no wall - full window view)
for($c=0;$c -lt 20;$c++){
  [Gen10]::Blit($S,(OF "carpet_edge"),($c*16),148)
  if(($c % 3) -eq 2){ [Gen10]::Blit($S,(OF "carpet_b"),($c*16),164) } else { [Gen10]::Blit($S,(OF "carpet_a"),($c*16),164) }
}
# props: cctv mounted on window mullion (mullion cols at x=192..202)
[Gen10]::Blit($S,$cam,178,88)
[Gen10]::Blit($S,$noti,130,84)
# desk + crt (bottom flush y=148)
[Gen10]::Blit($S,$desk,56,132)
[Gen10]::Blit($S,$crt,60,116)
# rain last
[Gen10]::Blit($S,$rain,0,0)
[Gen10]::Blit($S,$player,112,124)
[Gen10]::SavePx([Gen10]::Scale($S,4),(Join-Path $outD "ingame_mockup_stage2_office_props_x4.png"))
Write-Host "mockup v2 OK"
