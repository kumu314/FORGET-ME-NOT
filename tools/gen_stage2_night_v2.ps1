# ============================================================
# Stage-2 night parallax v2 (reference: warm-lit metropolis)
#   sky : deep indigo-violet gradient + stars
#   far : hazy skyline + lit spire landmark
#   mid : dense warm-window towers, neon signs, street glow
#   near: floor-to-ceiling mullions (kept from v1, violet-tinted)
#   rain: unchanged (existing overlay reused)
# Rewrites 17-layer parallax.json + composite + saves layers.
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$psx  = Join-Path $root "game\public\assets\parallax"
$outD = Join-Path $root "tools\_style_ref\out"
New-Item -ItemType Directory -Force -Path (Join-Path $psx "preview") | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class Gen9 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
  public static Color Mix(Color a, Color b, double t){
    int r=(int)Math.Round(a.R+(b.R-a.R)*t);
    int g=(int)Math.Round(a.G+(b.G-a.G)*t);
    int bl=(int)Math.Round(a.B+(b.B-a.B)*t);
    return Color.FromArgb(a.A,r,g,bl);
  }
  static int Seed(int s){ return (int)((long)s*1103515245L+12345L); }

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
    public void Grad(int x,int y,int w,int h,Color ca,Color cb){
      for(int j=0;j<h;j++){ double t=(h<=1)?0:(double)j/(h-1);
        Color cc=Mix(ca,cb,t);
        for(int i=0;i<w;i++) P(x+i,y+j,cc); } }
    public void Dith(int x,int y,int w,int h,Color a,Color b){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,((i+j)&1)==0?a:b); }
  }

  // warm window grid on a tower body
  public static void Windows(Px p,int x0,int y0,int w,int h,int seed,int litPct){
    int s=seed;
    for(int wy=y0+4; wy<y0+h-4; wy+=6){
      for(int wx=x0+3; wx<x0+w-3; wx+=5){
        s=Seed(s); int r=((s>>16)&0x7fff)%100;
        Color wc;
        if(r<litPct)        wc=(r%5==0)?From("#FFCE8A"):From("#FFB865");
        else if(r<litPct+8) wc=From("#7A98B8");
        else                wc=From("#1E2240");
        p.R(wx,wy,2,3,wc);
        if(wc==From("#FFB865")||wc==From("#FFCE8A")) p.P(wx,wy,From("#FFE2B0"));
      }
    }
  }

  public static Px Tower(int x,int top,int w,int h,Color body,int seed,int litPct){
    Px p=new Px(320,180);
    return p; // unused placeholder
  }

  // ---- sky: indigo-violet + stars + cloud wisps ----
  public static Px SkyV2(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,60,  From("#1E2344"), From("#2A2C56"));
    p.Grad(0,60,320,60, From("#2A2C56"), From("#3C3866"));
    p.Grad(0,120,320,60,From("#3C3866"), From("#4A4274"));
    int s=777;
    for(int k=0;k<42;k++){
      s=Seed(s); int sx=4+((s>>10)&0x1FF); if(sx>315) sx=315;
      s=Seed(s); int sy=((s>>14)&0x3F);
      s=Seed(s); Color sc=(((s>>8)&3)==0)?From("#8890C8"):From("#B8C4E8");
      p.P(sx,sy,sc);
    }
    p.Dith(30,30,90,2, From("#262A54"), From("#2A2C56"));
    p.Dith(190,46,110,2, From("#262A54"), From("#2A2C56"));
    p.Dith(100,62,70,2, From("#262A54"), From("#2A2C56"));
    return p;
  }

  // ---- far: hazy skyline + lit spire landmark ----
  public static Px FarV2(){
    Px p=new Px(320,180);
    Color b1=From("#323462"), b2=From("#383A68"), b3=From("#3E3A6A");
    // far blocks
    p.R(0,104,44,76,b1);
    p.R(70,96,36,84,b2);
    p.R(128,88,30,92,b1);
    p.R(180,100,52,80,b3);
    p.R(250,92,40,88,b2);
    p.R(300,108,20,72,b1);
    // dim windows
    int s=555;
    for(int k=0;k<26;k++){
      s=Seed(s); int bx=((s>>10)&7);
      s=Seed(s); int wx=6+((s>>12)&0x1FF); if(wx>312) wx=312;
      s=Seed(s); int wy=112+((s>>14)&0x3F);
      Color wc=(((s>>6)&3)==0)?From("#9A7A58"):From("#6A5E8A");
      if(bx!=2) p.R(wx,wy,2,2,wc);
    }
    // landmark spire with lit crown (Empire-vibe), crown + antenna pierce the sky
    p.R(46,84,14,96,b2);
    p.R(48,72,10,12,b2);
    p.R(50,62,6,10,From("#4A4E80"));
    p.R(52,38,2,24,From("#565A8C"));
    p.R(52,30,1,8,From("#8FA8E0"));
    p.HL(48,72,10,From("#A8BCE8"));
    p.HL(49,70,8,From("#A8BCE8"));
    p.P(50,64,From("#A8BCE8")); p.P(55,64,From("#A8BCE8"));
    p.P(52,29,From("#D8E4F8"));
    p.Dith(44,80,4,20, From("#A8BCE8"), b2);
    p.Dith(60,80,4,20, From("#A8BCE8"), b2);
    // spire windows warm dim
    for(int wy=90;wy<176;wy+=8){
      p.R(49,wy,2,3,From("#9A7A58"));
      p.R(55,wy+4,2,3,From("#6A5E8A"));
    }
    // horizon haze
    p.Grad(0,168,320,12, From("#383A68"), From("#4A4274"));
    return p;
  }

  // ---- mid: dense warm-lit towers + neon + street glow ----
  public static Px MidV2(){
    Px p=new Px(320,180);
    // low filler blocks
    p.R(0,118,320,62, From("#2A2650"));
    // towers
    p.R(4,30,40,120,  From("#2E2C54")); Windows(p,4,30,40,120,101,55);
    p.R(60,62,30,88,  From("#363260")); Windows(p,60,62,30,88,202,45);
    p.R(60,58,30,2,From("#4A467C")); p.P(74,56,From("#E8506A")); p.P(74,55,From("#FF8A9E"));
    p.R(98,18,56,132, From("#3A3660")); Windows(p,98,18,56,132,303,65);
    p.HL(98,18,56,From("#4E4A84"));
    p.R(162,54,26,96, From("#3E3A6E")); Windows(p,162,54,26,96,404,50);
    p.R(165,70,4,20,From("#E8506A")); p.R(166,71,2,18,From("#FF8A9E")); // red neon
    p.R(196,70,38,80, From("#322E58")); Windows(p,196,70,38,80,505,58);
    p.R(204,80,14,5,From("#2AA8A0")); p.HL(204,80,14,From("#4AD8D0"));  // cyan sign
    p.R(242,54,30,96, From("#363260")); Windows(p,242,54,30,96,606,60);
    p.R(256,44,1,10,From("#565A8C")); p.P(256,43,From("#E8506A"));      // antenna beacon
    p.R(280,80,34,70, From("#3E3A6E")); Windows(p,280,80,34,70,707,52);
    // street level: dark base + warm glow pools + car lights
    p.R(0,150,320,30, From("#332A4C"));
    for(int x=0;x<320;x+=64){ p.HL(x,150,64,From("#3E3458")); }
    p.Dith(36,166,64,10, From("#C08858"), From("#8A5E48"));
    p.Dith(150,168,58,9,  From("#C08858"), From("#8A5E48"));
    p.Dith(258,166,52,10, From("#C08858"), From("#8A5E48"));
    p.R(108,172,3,2,From("#F2E8D8")); p.R(113,172,3,2,From("#E8506A"));
    p.R(232,174,3,2,From("#F2E8D8")); p.R(238,174,3,2,From("#E8506A"));
    return p;
  }

  // ---- near: floor-to-ceiling mullions (kept, violet-tinted) ----
  public static Px NearV2(){
    Px p=new Px(320,180);
    for(int x=0;x<320;x+=64){
      p.R(x,0,10,180, From("#101626"));
      p.R(x+1,0,2,180, From("#3A4060"));
      p.R(x+8,0,2,180, From("#1C2436"));
    }
    p.R(0,172,320,8, From("#0A0E1A"));
    p.HL(0,172,320, From("#1A2030"));
    return p;
  }

  public static void Blit(Px d,Px s,int ox,int oy){
    for(int y=0;y<s.H;y++) for(int x=0;x<s.W;x++){
      Color c=s.c[x,y];
      if(c.A>0 && d.In(ox+x,oy+y)) d.c[ox+x,oy+y]=c;
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
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

$sky  = [Gen9]::SkyV2()
$far  = [Gen9]::FarV2()
$mid  = [Gen9]::MidV2()
$near = [Gen9]::NearV2()
[Gen9]::SavePx($sky, (Join-Path $psx "stage2_night_sky.png"))
[Gen9]::SavePx($far, (Join-Path $psx "stage2_night_far.png"))
[Gen9]::SavePx($mid, (Join-Path $psx "stage2_night_mid.png"))
[Gen9]::SavePx($near,(Join-Path $psx "stage2_night_near.png"))
Write-Host "stage2 v2 layers OK (rain overlay untouched)"

# ---- composite with existing rain overlay ----
$rain = [Gen9]::LoadPx((Join-Path $psx "stage2_rain_overlay.png"))
$c = New-Object Gen9+Px 320,180
[Gen9]::Blit($c,$sky,0,0)
[Gen9]::Blit($c,$far,0,0)
[Gen9]::Blit($c,$mid,0,0)
[Gen9]::Blit($c,$near,0,0)
[Gen9]::Blit($c,$rain,0,0)
[Gen9]::SavePx([Gen9]::Scale($c,3),(Join-Path $psx "preview\mockup_stage2_night_x3.png"))
Write-Host "composite OK"

# ---- manifest stays 17 layers (content unchanged, notes updated) ----
$m = @(
  '{"file":"stage1_morning_sky.png","layer":"sky","scrollFactor":0.10,"note":"outdoor morning, repeat-x"}',
  '{"file":"stage1_morning_far.png","layer":"far","scrollFactor":0.30,"note":"school silhouettes, repeat-x"}',
  '{"file":"stage1_morning_mid.png","layer":"mid","scrollFactor":0.60,"note":"trees+fence, repeat-x"}',
  '{"file":"stage1_morning_near.png","layer":"near","scrollFactor":0.85,"note":"hedge, repeat-x"}',
  '{"file":"stage1_indoor_sky.png","layer":"sky","scrollFactor":0.10,"note":"indoor ambient gradient (not literal sky), repeat-x"}',
  '{"file":"stage1_indoor_far.png","layer":"far","scrollFactor":0.30,"note":"corridor vista, warm far-window glow, repeat-x"}',
  '{"file":"stage1_indoor_mid.png","layer":"mid","scrollFactor":0.60,"note":"plain wall band (furniture via school_props tileset), repeat-x"}',
  '{"file":"stage1_indoor_near.png","layer":"near","scrollFactor":0.85,"note":"pilasters+light shafts (alpha), draw IN FRONT of entities, repeat-x"}',
  '{"file":"stage2_night_sky.png","layer":"sky","scrollFactor":0.10,"note":"indigo-violet night + stars, repeat-x"}',
  '{"file":"stage2_night_far.png","layer":"far","scrollFactor":0.30,"note":"hazy skyline + lit spire landmark, repeat-x"}',
  '{"file":"stage2_night_mid.png","layer":"mid","scrollFactor":0.60,"note":"dense warm-window towers, neon signs, street glow, repeat-x"}',
  '{"file":"stage2_night_near.png","layer":"near","scrollFactor":0.85,"note":"floor-to-ceiling mullions, repeat-x"}',
  '{"file":"stage2_rain_overlay.png","layer":"fx","scrollFactor":1.00,"note":"alpha streaks; animate tilePositionY for rain"}',
  '{"file":"stage3_sunset_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}',
  '{"file":"stage3_sunset_near.png","layer":"near","scrollFactor":0.85,"note":"repeat-x tileSprite"}'
)
$json = '{"layers":[' + ($m -join ",") + '],"meta":{"app":"FORGET-ME-NOT parallax by member-B","size":{"w":320,"h":180},"repeatX":true,"version":"1.2"}}'
[System.IO.File]::WriteAllText((Join-Path $psx "parallax.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "parallax.json v1.2 OK (17 layers)"
