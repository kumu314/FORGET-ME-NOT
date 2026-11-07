# ============================================================
# Indoor corridor parallax (stage1 alt background)
# Layers 320x180 seamless-x:
#   stage1_indoor_sky  : interior ambient gradient (not literal sky)
#   stage1_indoor_far  : corridor vista, doorways + far windows glow
#   stage1_indoor_mid  : lockers / bulletin board / classroom door / ceiling lights
#   stage1_indoor_near : pilasters + morning light shafts (alpha)
# Also rewrites parallax.json (17 layers) and saves composite mockups.
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$psx  = Join-Path $root "game\public\assets\parallax"
$tsDir= Join-Path $root "game\public\assets\tilesets"
$ref  = Join-Path $root "tools\_style_ref"
$outD = Join-Path $ref "out"
New-Item -ItemType Directory -Force -Path (Join-Path $psx "preview") | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class Gen5 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
  public static Color Lerp(Color a, Color b, double t){
    int r=(int)Math.Round(a.R+(b.R-a.R)*t);
    int g=(int)Math.Round(a.G+(b.G-a.G)*t);
    int bl=(int)Math.Round(a.B+(b.B-a.B)*t);
    return Color.FromArgb(255,r,g,bl);
  }
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
    public void Grad(int x,int y,int w,int h,Color ca,Color cb){
      for(int j=0;j<h;j++){ double t=(h<=1)?0:(double)j/(h-1);
        Color cc=Lerp(ca,cb,t);
        for(int i=0;i<w;i++) P(x+i,y+j,cc); } }
    public void Dith(int x,int y,int w,int h,Color a,Color b){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,((i+j)&1)==0?a:b); }
  }
  // alpha-blending blit (for translucent shafts over opaque layers)
  public static void BlendBlit(Px d,Px s,int ox,int oy){
    for(int y=0;y<s.H;y++) for(int x=0;x<s.W;x++){
      Color sc=s.c[x,y];
      int dx=ox+x, dy=oy+y;
      if(sc.A<=0 || !d.In(dx,dy)) continue;
      Color dc=d.c[dx,dy];
      double a=sc.A/255.0;
      int r=(int)Math.Round(sc.R*a+dc.R*(1-a));
      int g=(int)Math.Round(sc.G*a+dc.G*(1-a));
      int b=(int)Math.Round(sc.B*a+dc.B*(1-a));
      d.c[dx,dy]=Color.FromArgb(255,r,g,b);
    }
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

public static class Indoor {
  // ---- sky = bright warm interior ambient (Stardew-like) ----
  public static Gen5.Px Sky(){
    Gen5.Px p=new Gen5.Px(320,180);
    p.Grad(0,0,320,70,  Gen5.From("#F6EAD0"), Gen5.From("#F0E0C0"));
    p.Grad(0,70,320,60, Gen5.From("#F0E0C0"), Gen5.From("#EAD6B0"));
    p.Grad(0,130,320,50,Gen5.From("#EAD6B0"), Gen5.From("#E6CCA0"));
    return p;
  }
  // ---- far: sunlit corridor vista, soft warm doorways ----
  public static Gen5.Px Far(){
    Gen5.Px p=new Gen5.Px(320,180);
    // back wall
    p.R(0,52,320,110, Gen5.From("#E2CBA0"));
    p.HL(0,52,320, Gen5.From("#EAD6B4"));
    // doorways every 80px (soft warm shade, no deep darks)
    for(int x=0;x<320;x+=80){
      p.R(x+30,72,20,80, Gen5.From("#D0B48C"));
      p.HL(x+30,72,20, Gen5.From("#DEC49C"));
      p.R(x+30,76,20,4, Gen5.From("#C4A87C"));   // arch soft shadow
      p.V(x+48,76,76, Gen5.From("#CBAF85"));
    }
    // two far doorways only (vista stays dim; warm light lives in mid layer)
    // floor haze
    p.Grad(0,162,320,18, Gen5.From("#E6D2AC"), Gen5.From("#EEDCB8"));
    return p;
  }
  // ---- mid: PLANE wall band (furniture moved to school_props tileset) ----
  public static Gen5.Px Mid(){
    Gen5.Px p=new Gen5.Px(320,180);
    // ceiling band
    p.R(0,36,320,12, Gen5.From("#E8D6B0"));
    p.HL(0,47,320, Gen5.From("#DEC9A0"));
    // wall: warm cream, plain
    p.R(0,48,320,100, Gen5.From("#EBD6AC"));
    // floor
    p.R(0,148,320,32, Gen5.From("#E4CFA4"));
    p.HL(0,148,320, Gen5.From("#EEDAB2"));
    return p;
  }
  // ---- near: warm pilasters (every 80px) + bright shafts (translucent) ----
  public static Gen5.Px Near(){
    Gen5.Px p=new Gen5.Px(320,180);
    // pilasters
    for(int x=0;x<320;x+=80){
      p.R(x,0,14,180, Gen5.From("#E4CCA4"));
      p.V(x,0,180, Gen5.From("#F2DFBC"));
      p.V(x+12,0,180, Gen5.From("#D6BC90"));
      p.R(x,168,14,12, Gen5.From("#CDB488"));
      p.HL(x,168,14, Gen5.From("#D8C094"));
    }
    // morning shafts: slanted translucent bands from the mid window (wrap-safe)
    for(int k=0;k<2;k++){
      int bx=(k==0)?56:174;
      for(int i=0;i<90;i++){
        int xx=((bx+6+i)%320+320)%320;
        int yy=60+i;
        if(yy<180){
          for(int w=0;w<14;w++){
            int x2=((xx+w)%320+320)%320;
            p.P(x2,yy,Color.FromArgb(66,255,246,220));
          }
        }
      }
    }
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- build & save layers ----
$sky  = [Indoor]::Sky()
$far  = [Indoor]::Far()
$mid  = [Indoor]::Mid()
$near = [Indoor]::Near()
[Gen5]::SavePx($sky,  (Join-Path $psx "stage1_indoor_sky.png"))
[Gen5]::SavePx($far,  (Join-Path $psx "stage1_indoor_far.png"))
[Gen5]::SavePx($mid,  (Join-Path $psx "stage1_indoor_mid.png"))
[Gen5]::SavePx($near, (Join-Path $psx "stage1_indoor_near.png"))
Write-Host "indoor layers OK"

# ---- rewrite parallax.json (17 layers) ----
$m = @(
  '{"file":"stage1_morning_sky.png","layer":"sky","scrollFactor":0.10,"note":"outdoor morning, repeat-x"}',
  '{"file":"stage1_morning_far.png","layer":"far","scrollFactor":0.30,"note":"school silhouettes, repeat-x"}',
  '{"file":"stage1_morning_mid.png","layer":"mid","scrollFactor":0.60,"note":"trees+fence, repeat-x"}',
  '{"file":"stage1_morning_near.png","layer":"near","scrollFactor":0.85,"note":"hedge, repeat-x"}',
  '{"file":"stage1_indoor_sky.png","layer":"sky","scrollFactor":0.10,"note":"indoor ambient gradient (not literal sky), repeat-x"}',
  '{"file":"stage1_indoor_far.png","layer":"far","scrollFactor":0.30,"note":"corridor vista, warm far-window glow, repeat-x"}',
  '{"file":"stage1_indoor_mid.png","layer":"mid","scrollFactor":0.60,"note":"lockers/bulletin/door/ceiling lights, repeat-x"}',
  '{"file":"stage1_indoor_near.png","layer":"near","scrollFactor":0.85,"note":"pilasters+light shafts (alpha), draw IN FRONT of entities, repeat-x"}',
  '{"file":"stage2_night_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}',
  '{"file":"stage2_night_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}',
  '{"file":"stage2_night_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}',
  '{"file":"stage2_night_near.png","layer":"near","scrollFactor":0.85,"note":"window mullions, repeat-x"}',
  '{"file":"stage2_rain_overlay.png","layer":"fx","scrollFactor":1.00,"note":"alpha streaks; scroll fast or animate offset for rain"}',
  '{"file":"stage3_sunset_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_near.png","layer":"near","scrollFactor":0.85,"note":"repeat-x tileSprite"}'
)
$json = '{"layers":[' + ($m -join ",") + '],"meta":{"app":"FORGET-ME-NOT parallax by member-B","size":{"w":320,"h":180},"repeatX":true,"version":"1.1"}}'
[System.IO.File]::WriteAllText((Join-Path $psx "parallax.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "parallax.json updated (17 layers)"

# ---- bg composite mockup ----
$bg = New-Object Gen5+Px 320,180
[Gen5]::Blit($bg,$sky,0,0)
[Gen5]::Blit($bg,$far,0,0)
[Gen5]::Blit($bg,$mid,20,0)    # mid offset +20 so elements avoid pilaster columns at rest
[Gen5]::Blit($bg,$mid,-300,0)
[Gen5]::BlendBlit($bg,$near,0,0)
[Gen5]::SavePx([Gen5]::Scale($bg,3), (Join-Path $psx "preview\mockup_stage1_indoor_x3.png"))

# ---- ingame composite: indoor bg + existing tiles + A characters ----
$sheet = [Gen5]::LoadPx((Join-Path $tsDir "school_corridor.png"))
$eggs  = [Gen5]::LoadPx((Join-Path $tsDir "easter_eggs.png"))
$a1 = (Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$a2 = (Get-Content (Join-Path $tsDir "easter_eggs.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
function Frame-Of($frames,[string]$name,$sheetPx){
  foreach($f in $frames){ if($f.filename -eq $name){ return [Gen5]::Crop($sheetPx,$f.frame.x,$f.frame.y,16,16) } }
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
$player = [Gen5]::Crop([Gen5]::LoadPx((Join-Path $ref "player_youth.png")), 0,0,24,24)
$dog    = [Gen5]::Crop([Gen5]::LoadPx((Join-Path $ref "dog_puppy.png")),   0,0,12,12)

$S = New-Object Gen5+Px 320,180
[Gen5]::Blit($S,$sky,0,0)
[Gen5]::Blit($S,$far,0,0)
[Gen5]::Blit($S,$mid,20,0)
[Gen5]::Blit($S,$mid,-300,0)
[Gen5]::BlendBlit($S,$near,0,0)   # shafts bake onto vista; pilasters behind entities in this flat mockup
for($c=0;$c -lt 20;$c++){
  [Gen5]::Blit($S,$tFloorEdge,($c*16),148)
  $t=$tFloorA; if(($c % 3) -eq 2){ $t=$tFloorB }
  [Gen5]::Blit($S,$t,($c*16),164)
}
[Gen5]::Blit($S,$tPlant, 20,132)
[Gen5]::Blit($S,$tBin,  262,132)
[Gen5]::Blit($S,$tChalk, 58,140)
[Gen5]::Blit($S,$tScrap,196,140)
[Gen5]::Blit($S,$tBox,  210,132)
[Gen5]::Blit($S,$tBubble,214,114)
[Gen5]::Blit($S,$dog,    96,136)
[Gen5]::Blit($S,$player,116,124)
[Gen5]::SavePx([Gen5]::Scale($S,4), (Join-Path $outD "ingame_mockup_stage1_indoor_x4.png"))
Write-Host "composites OK"
