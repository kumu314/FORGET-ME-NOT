# ============================================================
# Stage-3 sunset parallax v2 (reference: golden-hour rooftops)
#   sky : bright golden gradient + glowing clouds + faint sun
#   far : fogged LIGHT town towers (lighter than sky = haze)
#   mid : rooftop band (water tower / satellite dishes / antennas
#         / chimneys / autumn trees), warm terracotta
#   near: dark plum facades + warm windows + roof clutter + leaves
# Rewrites 17-layer parallax.json + composite. Pure ASCII.
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

public static class Gen11 {
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
    public void Frame(int x,int y,int w,int h,Color col){
      HL(x,y,w,col); HL(x,y+h-1,w,col); V(x,y,h,col); V(x+w-1,y,h,col); }
    public void Grad(int x,int y,int w,int h,Color ca,Color cb){
      for(int j=0;j<h;j++){ double t=(h<=1)?0:(double)j/(h-1);
        Color cc=Mix(ca,cb,t);
        for(int i=0;i<w;i++) P(x+i,y+j,cc); } }
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

  // ---- sky: bright golden + glow + soft clouds ----
  public static Px SkyV3(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,60,  From("#FFF0C4"), From("#FFE0A0"));
    p.Grad(0,60,320,60, From("#FFE0A0"), From("#FFCE7E"));
    p.Grad(0,120,320,60,From("#FFCE7E"), From("#FFB65E"));
    // sun ambient glow (soft, not a hard disc)
    for(int y=0;y<180;y++) for(int x=0;x<320;x++){
      int dx=x-200, dy=y-96, d2=dx*dx+dy*dy;
      if(d2<=3600 && ((x+y)&1)==0) p.P(x,y,From("#FFF2CC"));
    }
    p.R(194,86,16,14,From("#FFF6DC"));
    // glowing clouds (lighter than sky, flat bottoms)
    p.R(52,38,64,10, From("#FFF4D2"));
    p.R(62,32,44,6,  From("#FFF4D2"));
    p.Dith(46,46,10,4,From("#FFF4D2"),From("#FFE0A0"));
    p.Dith(108,46,12,4,From("#FFF4D2"),From("#FFE0A0"));
    p.R(196,26,88,12, From("#FFF4D2"));
    p.R(214,20,52,6,  From("#FFF4D2"));
    p.Dith(188,36,12,5,From("#FFF4D2"),From("#FFE0A0"));
    p.Dith(276,36,12,5,From("#FFF4D2"),From("#FFE0A0"));
    p.R(96,70,90,8, From("#FFEBB8"));
    p.Dith(88,76,10,4,From("#FFEBB8"),From("#FFCE7E"));
    p.Dith(178,76,10,4,From("#FFEBB8"),From("#FFCE7E"));
    // birds
    p.P(58,44,From("#B8863C")); p.P(59,43,From("#B8863C")); p.P(60,44,From("#B8863C"));
    p.P(74,58,From("#B8863C")); p.P(75,57,From("#B8863C")); p.P(76,58,From("#B8863C"));
    return p;
  }

  // ---- far: fogged LIGHT town towers (lighter than sky) ----
  public static Px FarV3(){
    Px p=new Px(320,180);
    Color fog=From("#FFCE96");
    Color fog2=From("#FFC484");
    p.R(16,88,30,92,fog);
    p.R(60,74,22,106,fog2);
    p.R(94,94,40,86,fog);
    p.R(148,68,26,112,fog2);
    p.R(188,90,34,90,fog);
    p.R(234,78,20,102,fog2);
    p.R(262,96,46,84,fog);
    p.R(312,84,8,96,fog2);
    // faint windows
    int s=333;
    for(int k=0;k<18;k++){
      s=Seed(s); int wx=10+((s>>10)&0x1FE); if(wx>310) wx=310;
      s=Seed(s); int wy=86+((s>>14)&0x3C);
      p.R(wx,wy,2,3,From("#F0B878"));
    }
    // roof water tank silhouette on one fogged block
    p.R(96,86,10,8,fog2);
    p.R(98,78,2,8,fog2); p.R(103,78,2,8,fog2);
    // haze fade to horizon
    p.Grad(0,168,320,12, fog, From("#FFB65E"));
    return p;
  }

  // ---- mid: rooftop band (water tower/dishes/antennas/chimneys/trees) ----
  public static Px MidV3(){
    Px p=new Px(320,180);
    Color body=From("#C87A4E"), bodyDk=From("#A85E3C"), sil=From("#8A5238");
    // rooftop parapets at varying heights, bodies below
    int[] segX={0,70,150,230};
    int[] segY={118,108,122,112};
    int[] segW={70,80,80,90};
    for(int i=0;i<4;i++){
      p.R(segX[i],segY[i],segW[i],160-segY[i]+20, body);
      p.HL(segX[i],segY[i],segW[i], From("#D88A58"));
      p.HL(segX[i],segY[i]+1,segW[i], From("#B46844"));
      p.R(segX[i],158,segW[i],22, bodyDk);
    }
    // water tower on first roof
    p.R(40,104,2,14,sil); p.R(52,104,2,14,sil);
    p.R(34,88,22,18, From("#B4663E"));
    p.HL(34,88,22, From("#C8764A"));
    p.R(38,82,14,6, From("#C8764A"));
    p.R(42,78,6,4, sil);
    p.P(44,80,From("#E89458"));
    // satellite dish
    p.R(116,96,10,6, sil);
    p.Dith(117,97,8,4, From("#A85E3C"), sil);
    p.V(120,102,6, sil);
    p.R(118,106,5,2, sil);
    // tv antennas
    p.R(200,94,2,16, From("#7A4430"));
    p.R(194,96,12,2, From("#7A4430"));
    p.R(196,101,8,2, From("#7A4430"));
    p.R(284,100,2,12, From("#7A4430"));
    p.R(279,102,10,2, From("#7A4430"));
    // chimneys
    p.R(148,100,8,8, bodyDk);
    p.HL(148,100,8, From("#B46844"));
    p.R(246,102,10,6, bodyDk);
    // bare autumn trees peeking above roofline
    p.R(96,96,3,26, From("#8A4E30"));
    for(int y=82;y<=106;y++) for(int x=88;x<=106;x++){
      int dx=x-97, dy=y-94, d2=dx*dx+dy*dy;
      if(d2<=110 && ((x*3+y)&3)!=0) p.P(x,y,From("#E88A3C"));
    }
    p.P(92,90,From("#F0A24C")); p.P(101,88,From("#F0A24C")); p.P(97,99,From("#D8742E"));
    p.R(310,104,2,18, From("#8A4E30"));
    p.Dith(302,96,18,12, From("#E88A3C"), From("#FFAD52"));
    // falling leaves
    p.P(60,100,From("#F0A24C")); p.P(130,92,From("#E88A3C"));
    p.P(210,86,From("#F0A24C")); p.P(298,108,From("#E88A3C"));
    return p;
  }

  // ---- near: dark plum facades + warm windows + clutter + leaves ----
  public static Px NearV3(){
    Px p=new Px(320,180);
    // facades
    p.R(0,124,70,56,   From("#503A56"));
    p.R(70,132,110,48, From("#46324E"));
    p.R(180,124,80,56, From("#553D5C"));
    p.R(260,132,60,48, From("#4A3550"));
    // parapet caps
    p.R(0,122,70,2,   From("#6A4C6E"));
    p.R(70,130,110,2, From("#5E4462"));
    p.R(180,122,80,2, From("#6A4C6E"));
    p.R(260,130,60,2, From("#5E4462"));
    // warm windows (sparse lit, some off)
    int s=909;
    for(int f=0;f<4;f++){
      int fx=(f==0)?8:(f==1)?80:(f==2)?190:268;
      int fw=(f==0)?54:(f==1)?90:(f==2)?60:44;
      int fy=(f==0)?132:(f==1)?140:(f==2)?132:140;
      for(int r=0;r<2;r++){
        for(int cix=0;cix<fw/18;cix++){
          s=Seed(s); int lit=((s>>16)&0x7fff)%100;
          Color wc=(lit<30)?From("#FFB865"):((lit<38)?From("#FFD98A"):From("#3A2A44"));
          p.R(fx+6+cix*18, fy+r*16, 8, 10, wc);
          if(lit<38) p.HL(fx+6+cix*18, fy+r*16, 8, From("#FFD98A"));
          p.Frame(fx+5+cix*18, fy-1+r*16, 10, 12, From("#33253E"));
        }
      }
    }
    // roof clutter silhouettes
    p.R(26,114,10,8, From("#3A2A44"));
    p.R(150,112,2,12, From("#33253E"));
    p.R(144,114,12,2, From("#33253E"));
    p.R(214,138,8,6, From("#3A2A44"));
    p.P(34,118,From("#E88A3C")); p.P(37,116,From("#E88A3C")); p.P(56,120,From("#F0A24C"));
    // fire escape hint on facade 2
    p.R(66,140,18,2, From("#33253E"));
    p.R(66,148,18,2, From("#33253E"));
    p.R(66,140,1,10, From("#33253E")); p.R(83,140,1,10, From("#33253E"));
    // falling autumn leaves in foreground air
    p.P(40,100,From("#F0A24C")); p.P(92,84,From("#E88A3C"));
    p.P(158,108,From("#F0A24C")); p.P(238,90,From("#E88A3C"));
    p.P(296,118,From("#F0A24C"));
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

$sky  = [Gen11]::SkyV3()
$far  = [Gen11]::FarV3()
$mid  = [Gen11]::MidV3()
$near = [Gen11]::NearV3()
[Gen11]::SavePx($sky, (Join-Path $psx "stage3_sunset_sky.png"))
[Gen11]::SavePx($far, (Join-Path $psx "stage3_sunset_far.png"))
[Gen11]::SavePx($mid, (Join-Path $psx "stage3_sunset_mid.png"))
[Gen11]::SavePx($near,(Join-Path $psx "stage3_sunset_near.png"))
Write-Host "stage3 v2 layers OK"

# ---- composite ----
$c = New-Object Gen11+Px 320,180
[Gen11]::Blit($c,$sky,0,0)
[Gen11]::Blit($c,$far,0,0)
[Gen11]::Blit($c,$mid,0,0)
[Gen11]::Blit($c,$near,0,0)
[Gen11]::SavePx([Gen11]::Scale($c,3),(Join-Path $psx "preview\mockup_stage3_sunset_x3.png"))
Write-Host "composite OK"

# ---- manifest v1.3 (17 layers, stage3 notes updated) ----
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
  '{"file":"stage3_sunset_sky.png","layer":"sky","scrollFactor":0.10,"note":"golden-hour gradient + glowing clouds + sun glow, repeat-x"}',
  '{"file":"stage3_sunset_far.png","layer":"far","scrollFactor":0.30,"note":"fogged LIGHT town towers (haze lighter than sky), repeat-x"}',
  '{"file":"stage3_sunset_mid.png","layer":"mid","scrollFactor":0.60,"note":"rooftop band: water tower/dishes/antennas/chimneys + autumn trees, repeat-x"}',
  '{"file":"stage3_sunset_near.png","layer":"near","scrollFactor":0.85,"note":"dark plum facades + warm windows + roof clutter + falling leaves, repeat-x"}'
)
$json = '{"layers":[' + ($m -join ",") + '],"meta":{"app":"FORGET-ME-NOT parallax by member-B","size":{"w":320,"h":180},"repeatX":true,"version":"1.3"}}'
[System.IO.File]::WriteAllText((Join-Path $psx "parallax.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "parallax.json v1.3 OK (17 layers)"
