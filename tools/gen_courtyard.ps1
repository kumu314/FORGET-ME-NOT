# ============================================================
# Stage-3 courtyard set (reference: chinese old-house yard)
#   parallax x4 : stage3_courtyard_sky/far/mid/near
#   tiles  x13  : courtyard_props.png (door couplets, trellis, brick wall,
#                 lattice window, eave, stone slab, water vat, table,
#                 stool, 4 flower pots, tea tray) - non-16 sizes allowed
# Rewrites parallax.json to 21 layers (v1.4). Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tsDir= Join-Path $root "game\public\assets\tilesets"
$psx  = Join-Path $root "game\public\assets\parallax"
$outD = Join-Path $root "tools\_style_ref\out"
New-Item -ItemType Directory -Force -Path (Join-Path $psx "preview") | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class Gen12 {
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

  // ---------- parallax layers ----------
  public static Px CySky(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,70,  From("#DFF0DC"), From("#EEF2D4"));
    p.Grad(0,70,320,60, From("#EEF2D4"), From("#FBEFC8"));
    p.Grad(0,130,320,50,From("#FBEFC8"), From("#FDEBC0"));
    p.R(40,30,54,8, From("#FFFFFF"));
    p.R(48,26,38,5, From("#FFFFFF"));
    p.R(210,44,70,9, From("#FFFFFF"));
    p.Dith(32,38,10,4, From("#FFFFFF"), From("#EEF2D4"));
    p.P(120,40,From("#8AA89A")); p.P(121,39,From("#8AA89A")); p.P(122,40,From("#8AA89A"));
    p.P(160,34,From("#8AA89A")); p.P(161,33,From("#8AA89A")); p.P(162,34,From("#8AA89A"));
    return p;
  }
  public static Px CyFar(){
    Px p=new Px(320,180);
    // misty green hills
    p.R(0,118,320,62, From("#C4DCA4"));
    for(int x=0;x<320;x++){
      int h=8+((int)(Math.Sin(x/40.0)*5))+((x*7)%4);
      p.R(x,118-h,1,h,From("#D8E8B8"));
    }
    // tiny village houses
    int[] hx={28,96,170,246};
    for(int i=0;i<4;i++){
      int x=hx[i];
      p.R(x,112,20,10,From("#F2EFE0"));
      p.R(x-1,110,22,3,From("#8A9590"));
      p.P(x+8,116,From("#7A6A50"));
    }
    // haze fade at base
    p.Grad(0,148,320,14, From("#D8E8B8"), From("#E8ECC8"));
    return p;
  }
  public static Px CyMid(){
    Px p=new Px(320,180);
    // tree canopy across the top
    for(int k=0;k<26;k++){
      int cx=(k*37)%320, cy=6+((k*13)%26), r=12+((k*7)%10);
      for(int y=-r;y<=r;y++) for(int x=-r;x<=r;x++){
        int d2=x*x+y*y;
        if(d2<=r*r && ((x+y+k)&5)!=4) p.P(((cx+x)%320+320)%320, cy+y, From((k%3==0)?"#6FA84E":((k%3==1)?"#8CC468":"#5A9040")));
      }
    }
    p.R(296,0,8,66,From("#7A5A3C"));
    p.V(296,0,66,From("#8A6A48")); p.V(302,0,66,From("#6A4E30"));
    // tiled roof (grey)
    p.R(0,64,320,8, From("#7A867E"));
    p.HL(0,64,320, From("#98A29A"));
    p.R(0,72,320,12, From("#98A29A"));
    for(int x=0;x<320;x+=8) p.V(x,72,12, From("#8A9590"));
    p.R(0,84,320,2, From("#5E6A64"));
    // white wall
    p.R(0,86,320,58, From("#EFE9D8"));
    p.Dith(30,96,8,20, From("#E2DBC4"), From("#EFE9D8"));
    p.Dith(250,100,10,16, From("#E2DBC4"), From("#EFE9D8"));
    // center double door with red couplets
    p.R(146,88,28,6, From("#5E4230"));                 // lintel plaque
    p.HL(146,88,28, From("#7A563C"));
    p.R(140,94,40,50, From("#6E4A2E"));
    p.R(143,96,15,46, From("#8A5E3C"));
    p.R(162,96,15,46, From("#8A5E3C"));
    p.V(157,96,46, Gen12.From("#5E4230")); p.V(162,96,46, From("#5E4230"));
    p.P(150,120,From("#5E4230")); p.P(167,120,From("#5E4230"));
    p.R(133,94,5,44, From("#C43B3B"));                 // couplet left
    p.R(182,94,5,44, From("#C43B3B"));                 // couplet right
    for(int y=98;y<134;y+=6){ p.P(135,y,From("#F0D060")); p.P(184,y,From("#F0D060")); }
    // lattice windows
    for(int wx=0;wx<2;wx++){
      int x=(wx==0)?96:206;
      p.R(x,100,26,22, From("#6E4A2E"));
      p.R(x+2,102,22,18, From("#F2ECD8"));
      for(int gx=0;gx<3;gx++) p.V(x+6+gx*6,102,18, From("#8A5E3C"));
      for(int gy=0;gy<2;gy++) p.HL(x+2,108+gy*7,22, From("#8A5E3C"));
      p.R(x+10,92,2,8, From("#B03A3A"));               // small red lantern over window
      p.R(x+9,99,4,2, From("#C43B3B"));
    }
    // potted plants by the door
    p.R(128,136,8,8, From("#8CB04A")); p.R(129,132,6,5, From("#6FA84E"));
    p.R(184,136,8,8, From("#B0603A")); p.Dith(184,132,8,5, From("#A878C8"), From("#C89CE0"));
    // stone foundation
    p.R(0,144,320,10, From("#B8AFA0"));
    p.HL(0,144,320, From("#CCC4B4"));
    p.R(138,146,44,8, From("#C8BFA8"));
    return p;
  }
  public static Px CyNear(){
    Px p=new Px(320,180);
    // bamboo trellis with vines (right)
    for(int x=0;x<5;x++) p.R(240+x*16,96,2,52, From("#C8A86A"));
    p.R(240,100,66,2, From("#C8A86A"));
    p.R(240,116,66,2, From("#C8A86A"));
    for(int k=0;k<14;k++){
      int vx=242+((k*17)%60), vy=100+((k*11)%40);
      p.Dith(vx,vy,6,5, From("#8CB04A"), From("#6FA84E"));
    }
    p.P(266,124,From("#8CB04A")); p.P(266,125,From("#6E9440"));
    p.P(296,132,From("#8CB04A")); p.P(296,133,From("#6E9440"));
    // stone bench (left)
    p.R(96,134,28,8, From("#B8B2A4"));
    p.HL(96,134,28, From("#CCC6B8"));
    p.R(96,142,28,6, From("#A29C90"));
    // pots on ground between walls
    p.R(104,140,10,8, From("#7CA0C8")); p.R(105,136,8,5, From("#F2EFE0"));
    p.P(107,137,From("#E86A8A")); p.P(110,138,From("#F0D060"));
    p.R(206,140,10,8, From("#B0603A")); p.Dith(207,135,8,6, From("#E86A8A"), From("#F0A0B4"));
    // falling petals
    p.P(70,90,From("#F0A0B4")); p.P(180,104,From("#F0A0B4")); p.P(228,80,From("#F0A0B4"));
    return p;
  }

  // ---------- courtyard prop sprites ----------
  public static Px BrickWall(){
    Px p=new Px(32,16);
    p.R(0,0,32,16, From("#B85C44"));
    p.HL(0,0,32, From("#CC704E"));
    for(int y=3;y<16;y+=4) p.HL(0,y,32, From("#8A4232"));
    p.V(8,0,3,From("#8A4232")); p.V(24,4,3,From("#8A4232"));
    p.V(4,8,3,From("#8A4232")); p.V(20,8,3,From("#8A4232"));
    p.V(12,12,3,From("#8A4232")); p.V(28,12,3,From("#8A4232"));
    p.Dith(2,5,6,2, From("#A84E3A"), From("#B85C44"));
    p.Dith(22,9,6,2, From("#A84E3A"), From("#B85C44"));
    return p;
  }
  public static Px DoorCouplets(){
    Px p=new Px(32,44);
    p.R(4,0,24,44, From("#6E4A2E"));
    p.R(6,2,9,40, From("#8A5E3C"));
    p.R(17,2,9,40, From("#8A5E3C"));
    p.V(15,2,42, From("#5E4230")); p.V(17,2,42, From("#5E4230"));
    p.HL(6,2,20, From("#A87848"));
    p.P(11,22,From("#5E4230")); p.P(20,22,From("#5E4230"));
    p.R(1,2,3,38, From("#C43B3B"));
    p.R(28,2,3,38, From("#C43B3B"));
    for(int y=6;y<36;y+=5){ p.P(2,y,From("#F0D060")); p.P(29,y,From("#F0D060")); }
    p.R(2,42,28,2, From("#5E4230"));
    return p;
  }
  public static Px LatticeWindow(){
    Px p=new Px(16,16);
    p.R(0,0,16,16, From("#6E4A2E"));
    p.R(2,2,12,12, From("#F2ECD8"));
    p.V(5,2,2, From("#8A5E3C")); p.V(8,2,2, From("#8A5E3C")); p.V(11,2,2, From("#8A5E3C"));
    p.R(2,5,12,1, From("#8A5E3C")); p.R(2,9,12,1, From("#8A5E3C"));
    p.P(4,3,From("#FFF6DE"));
    return p;
  }
  public static Px EaveTile(){
    Px p=new Px(16,16);
    p.R(0,2,16,10, From("#98A29A"));
    p.R(0,0,16,2, From("#7A867E"));
    p.HL(0,0,16, From("#98A29A"));
    for(int x=0;x<16;x+=4){ p.V(x,2,10, From("#8A9590")); p.P(x+1,4,From("#AAB2AA")); }
    p.R(0,12,16,2, From("#5E6A64"));
    p.P(3,14,From("#5E6A64")); p.P(11,14,From("#5E6A64"));
    return p;
  }
  public static Px StoneSlab(){
    Px p=new Px(16,16);
    p.R(0,0,16,16, From("#C8C2B4"));
    p.HL(0,0,16, From("#D8D2C4"));
    p.R(0,7,16,1, From("#A29C90"));
    p.R(0,15,16,1, From("#A29C90"));
    p.V(7,0,7, From("#B0AA9C"));
    p.V(12,8,8, From("#B0AA9C"));
    p.Dith(2,3,4,3, From("#B8B2A4"), From("#C8C2B4"));
    return p;
  }
  public static Px WaterVat(){
    Px p=new Px(16,14);
    p.R(2,1,12,12, From("#8A6A50"));
    p.HL(2,1,12, From("#A2825E"));
    p.R(3,4,10,8, From("#7A5C44"));
    p.V(2,1,12, From("#6E5240")); p.V(13,1,12, From("#6E5240"));
    p.R(1,0,14,2, From("#6E5240"));
    p.R(3,2,10,1, From("#5A7A8C"));
    p.R(0,13,16,1, From("#5A4534"));
    return p;
  }
  public static Px WoodTable(){
    Px p=new Px(24,14);
    p.R(2,0,20,4, From("#C8A86A"));
    p.HL(2,0,20, From("#DAC07E"));
    p.HL(2,3,20, From("#A8884E"));
    p.R(4,4,3,8, From("#A8884E"));
    p.R(17,4,3,8, From("#A8884E"));
    p.R(2,12,20,2, From("#8A6E42"));
    p.R(9,1,6,2, From("#E8E4D8"));
    p.P(10,1,From("#8CB04A")); p.P(13,1,From("#C85A4A"));
    return p;
  }
  public static Px WoodStool(){
    Px p=new Px(10,10);
    p.R(1,0,8,3, From("#C8A86A"));
    p.HL(1,0,8, From("#DAC07E"));
    p.R(2,3,6,2, From("#A8884E"));
    p.R(1,5,2,5, From("#8A6E42"));
    p.R(7,5,2,5, From("#8A6E42"));
    return p;
  }
  public static Px PotRed(){
    Px p=new Px(12,12);
    p.R(3,6,6,6, From("#7CA0C8"));
    p.HL(3,6,6, From("#9CBAD8"));
    p.P(5,8,From("#E8E4D8"));
    p.R(2,1,8,6, From("#D85A4A"));
    p.P(3,2,From("#F07A62")); p.P(7,3,From("#F07A62"));
    p.P(5,0,From("#F2907A"));
    return p;
  }
  public static Px PotPink(){
    Px p=new Px(12,12);
    p.R(3,6,6,6, From("#B0603A"));
    p.HL(3,6,6, From("#C8764A"));
    p.R(2,1,8,6, From("#F0A0B4"));
    p.P(3,2,From("#F8C0CC")); p.P(7,2,From("#F8C0CC"));
    p.P(5,0,From("#F8C0CC")); p.P(5,4,From("#D87890"));
    return p;
  }
  public static Px PotGreen(){
    Px p=new Px(12,12);
    p.R(3,6,6,6, From("#F2EFE0"));
    p.HL(3,6,6, From("#FFFFFF"));
    p.V(3,6,6, From("#D0D8E8"));
    p.R(2,1,8,6, From("#6FA84E"));
    p.P(3,2,From("#8CC468")); p.P(7,2,From("#8CC468"));
    p.P(5,0,From("#5A9040"));
    return p;
  }
  public static Px PotPurple(){
    Px p=new Px(12,12);
    p.R(3,6,6,6, From("#B0603A"));
    p.HL(3,6,6, From("#C8764A"));
    p.R(2,1,8,6, From("#A878C8"));
    p.P(3,2,From("#C89CE0")); p.P(7,3,From("#C89CE0"));
    p.P(5,0,From("#D8B0EC"));
    return p;
  }
  public static Px TeaTray(){
    Px p=new Px(14,10);
    p.R(1,2,12,7, From("#8A5E3C"));
    p.HL(1,2,12, From("#A87848"));
    p.R(1,8,12,2, From("#6E4A2E"));
    p.R(4,0,4,3, From("#E8E4D8"));
    p.P(5,0,From("#B03A3A"));
    p.R(9,1,3,2, From("#9CBAD8"));
    return p;
  }
  public static Gen12.Px Trellis(){
    Gen12.Px p=new Gen12.Px(32,32);
    for(int x=0;x<5;x++) p.R(x*8,0,2,32, From("#C8A86A"));
    p.R(0,6,32,2, From("#C8A86A"));
    p.R(0,18,32,2, From("#C8A86A"));
    for(int k=0;k<10;k++){
      int vx=2+((k*13)%28), vy=4+((k*9)%22);
      p.Dith(vx,vy,6,5, From("#8CB04A"), From("#6FA84E"));
    }
    p.P(9,14,From("#8CB04A")); p.P(9,15,From("#6E9440"));
    p.P(25,22,From("#8CB04A")); p.P(25,23,From("#6E9440"));
    p.P(17,8,From("#F2907A"));
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- parallax layers ----
$sky=[Gen12]::CySky(); $far=[Gen12]::CyFar(); $mid=[Gen12]::CyMid(); $near=[Gen12]::CyNear()
[Gen12]::SavePx($sky,(Join-Path $psx "stage3_courtyard_sky.png"))
[Gen12]::SavePx($far,(Join-Path $psx "stage3_courtyard_far.png"))
[Gen12]::SavePx($mid,(Join-Path $psx "stage3_courtyard_mid.png"))
[Gen12]::SavePx($near,(Join-Path $psx "stage3_courtyard_near.png"))
$c=New-Object Gen12+Px 320,180
[Gen12]::Blit($c,$sky,0,0); [Gen12]::Blit($c,$far,0,0); [Gen12]::Blit($c,$mid,0,0); [Gen12]::Blit($c,$near,0,0)
[Gen12]::SavePx([Gen12]::Scale($c,3),(Join-Path $psx "preview\mockup_stage3_courtyard_x3.png"))
Write-Host "courtyard parallax OK"

# ---- prop sheet 160x60 ----
$sheet=New-Object Gen12+Px 160,80
$door=[Gen12]::DoorCouplets()
[Gen12]::Blit($sheet,$door,0,0)
$bw=[Gen12]::BrickWall();   [Gen12]::Blit($sheet,$bw,32,0)
$lw=[Gen12]::LatticeWindow(); [Gen12]::Blit($sheet,$lw,64,0)
$et=[Gen12]::EaveTile();    [Gen12]::Blit($sheet,$et,80,0)
$ss=[Gen12]::StoneSlab();   [Gen12]::Blit($sheet,$ss,96,0)
$wv=[Gen12]::WaterVat();    [Gen12]::Blit($sheet,$wv,112,0)
$tb=[Gen12]::WoodTable();   [Gen12]::Blit($sheet,$tb,128,0)
$st=[Gen12]::WoodStool();   [Gen12]::Blit($sheet,$st,0,44)
$pr=[Gen12]::PotRed();      [Gen12]::Blit($sheet,$pr,10,44)
$pp=[Gen12]::PotPink();     [Gen12]::Blit($sheet,$pp,22,44)
$pg=[Gen12]::PotGreen();    [Gen12]::Blit($sheet,$pg,34,44)
$pu=[Gen12]::PotPurple();   [Gen12]::Blit($sheet,$pu,46,44)
$tt=[Gen12]::TeaTray();     [Gen12]::Blit($sheet,$tt,58,44)
$tr=[Gen12]::Trellis();     [Gen12]::Blit($sheet,$tr,104,44)
[Gen12]::SavePx($sheet,(Join-Path $tsDir "courtyard_props.png"))

$frames=@(
  '{"filename":"door_couplets","frame":{"x":0,"y":0,"w":32,"h":44},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":44},"sourceSize":{"w":32,"h":44},"meta":{"role":"decor","solid":false,"note":"old-house wooden door with red couplets, bottom flush with floor"}}',
  '{"filename":"brick_wall_low","frame":{"x":32,"y":0,"w":32,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":16},"sourceSize":{"w":32,"h":16},"meta":{"role":"decor","solid":false,"note":"red brick low wall segment, tiling horizontally"}}',
  '{"filename":"lattice_window","frame":{"x":64,"y":0,"w":16,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":16,"h":16},"sourceSize":{"w":16,"h":16},"meta":{"role":"decor","solid":false,"note":"wooden lattice window, mount on white wall"}}',
  '{"filename":"eave_tile","frame":{"x":80,"y":0,"w":16,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":16,"h":16},"sourceSize":{"w":16,"h":16},"meta":{"role":"decor","solid":false,"note":"grey tiled eave strip, tiling horizontally"}}',
  '{"filename":"stone_slab","frame":{"x":96,"y":0,"w":16,"h":16},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":16,"h":16},"sourceSize":{"w":16,"h":16},"meta":{"role":"ground","solid":true,"note":"stone slab pavement tile"}}',
  '{"filename":"water_vat","frame":{"x":112,"y":0,"w":16,"h":14},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":16,"h":14},"sourceSize":{"w":16,"h":14},"meta":{"role":"decor","solid":true,"note":"water vat, bottom flush with floor"}}',
  '{"filename":"wood_table","frame":{"x":128,"y":0,"w":24,"h":14},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":24,"h":14},"sourceSize":{"w":24,"h":14},"meta":{"role":"platform","solid":true,"note":"tea table with tray, bottom flush with floor"}}',
  '{"filename":"wood_stool","frame":{"x":0,"y":44,"w":10,"h":10},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":10,"h":10},"sourceSize":{"w":10,"h":10},"meta":{"role":"decor","solid":true,"note":"wooden stool"}}',
  '{"filename":"pot_red","frame":{"x":10,"y":44,"w":12,"h":12},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":12,"h":12},"sourceSize":{"w":12,"h":12},"meta":{"role":"decor","solid":false,"note":"red flowers in blue-white pot"}}',
  '{"filename":"pot_pink","frame":{"x":22,"y":44,"w":12,"h":12},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":12,"h":12},"sourceSize":{"w":12,"h":12},"meta":{"role":"decor","solid":false,"note":"pink flowers in terracotta pot"}}',
  '{"filename":"pot_green","frame":{"x":34,"y":44,"w":12,"h":12},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":12,"h":12},"sourceSize":{"w":12,"h":12},"meta":{"role":"decor","solid":false,"note":"green plant in white pot"}}',
  '{"filename":"pot_purple","frame":{"x":46,"y":44,"w":12,"h":12},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":12,"h":12},"sourceSize":{"w":12,"h":12},"meta":{"role":"decor","solid":false,"note":"purple flowers in terracotta pot"}}',
  '{"filename":"tea_tray","frame":{"x":58,"y":44,"w":14,"h":10},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":14,"h":10},"sourceSize":{"w":14,"h":10},"meta":{"role":"decor","solid":false,"note":"tea tray with cups, place on table top"}}',
  '{"filename":"trellis","frame":{"x":104,"y":44,"w":32,"h":32},"rotated":false,"trimmed":false,"spriteSourceSize":{"x":0,"y":0,"w":32,"h":32},"sourceSize":{"w":32,"h":32},"meta":{"role":"decor","solid":false,"note":"bamboo trellis with vines and gourds, bottom flush with floor"}}'
)
$json='{"frames":[' + ($frames -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"courtyard_props.png","format":"RGBA8888","size":{"w":160,"h":80},"scale":"1","version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $tsDir "courtyard_props.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "courtyard_props sheet OK (13 sprites)"

# ---- sheet preview x4 ----
$pv=New-Object Gen12+Px 640,240
for($y=0;$y -lt 240;$y++){ for($x=0;$x -lt 640;$x++){ $pv.c[$x,$y]=[Gen12]::From("#252B42") } }
[Gen12]::Blit($pv,[Gen12]::Scale($door,4),8,8)
[Gen12]::Blit($pv,[Gen12]::Scale($bw,4),140,8)
[Gen12]::Blit($pv,[Gen12]::Scale($lw,4),272,8)
[Gen12]::Blit($pv,[Gen12]::Scale($et,4),336,8)
[Gen12]::Blit($pv,[Gen12]::Scale($ss,4),400,8)
[Gen12]::Blit($pv,[Gen12]::Scale($wv,4),464,8)
[Gen12]::Blit($pv,[Gen12]::Scale($tb,4),528,8)
[Gen12]::Blit($pv,[Gen12]::Scale($st,4),8,184)
[Gen12]::Blit($pv,[Gen12]::Scale($pr,4),56,184)
[Gen12]::Blit($pv,[Gen12]::Scale($pp,4),112,184)
[Gen12]::Blit($pv,[Gen12]::Scale($pg,4),168,184)
[Gen12]::Blit($pv,[Gen12]::Scale($pu,4),224,184)
[Gen12]::Blit($pv,[Gen12]::Scale($tt,4),280,184)
[Gen12]::SavePx($pv,(Join-Path $tsDir "preview\courtyard_props_sheet_x4.png"))

# ---- manifest v1.4: 21 layers ----
$m=@(
  '{"file":"stage1_morning_sky.png","layer":"sky","scrollFactor":0.10,"note":"outdoor morning, repeat-x"}',
  '{"file":"stage1_morning_far.png","layer":"far","scrollFactor":0.30,"note":"school silhouettes, repeat-x"}',
  '{"file":"stage1_morning_mid.png","layer":"mid","scrollFactor":0.60,"note":"trees+fence, repeat-x"}',
  '{"file":"stage1_morning_near.png","layer":"near","scrollFactor":0.85,"note":"hedge, repeat-x"}',
  '{"file":"stage1_indoor_sky.png","layer":"sky","scrollFactor":0.10,"note":"indoor ambient gradient, repeat-x"}',
  '{"file":"stage1_indoor_far.png","layer":"far","scrollFactor":0.30,"note":"corridor vista, repeat-x"}',
  '{"file":"stage1_indoor_mid.png","layer":"mid","scrollFactor":0.60,"note":"plain wall band, repeat-x"}',
  '{"file":"stage1_indoor_near.png","layer":"near","scrollFactor":0.85,"note":"pilasters+light shafts (alpha), repeat-x"}',
  '{"file":"stage2_night_sky.png","layer":"sky","scrollFactor":0.10,"note":"indigo-violet night + stars, repeat-x"}',
  '{"file":"stage2_night_far.png","layer":"far","scrollFactor":0.30,"note":"hazy skyline + lit spire, repeat-x"}',
  '{"file":"stage2_night_mid.png","layer":"mid","scrollFactor":0.60,"note":"warm-window towers + neon + street glow, repeat-x"}',
  '{"file":"stage2_night_near.png","layer":"near","scrollFactor":0.85,"note":"floor-to-ceiling mullions, repeat-x"}',
  '{"file":"stage2_rain_overlay.png","layer":"fx","scrollFactor":1.00,"note":"animate tilePositionY for rain"}',
  '{"file":"stage3_sunset_sky.png","layer":"sky","scrollFactor":0.10,"note":"golden-hour gradient + glowing clouds, repeat-x"}',
  '{"file":"stage3_sunset_far.png","layer":"far","scrollFactor":0.30,"note":"fogged light town towers, repeat-x"}',
  '{"file":"stage3_sunset_mid.png","layer":"mid","scrollFactor":0.60,"note":"rooftop band + autumn trees, repeat-x"}',
  '{"file":"stage3_sunset_near.png","layer":"near","scrollFactor":0.85,"note":"plum facades + warm windows, repeat-x"}',
  '{"file":"stage3_courtyard_sky.png","layer":"sky","scrollFactor":0.10,"note":"spring courtyard: soft green-cream sky, repeat-x"}',
  '{"file":"stage3_courtyard_far.png","layer":"far","scrollFactor":0.30,"note":"misty hills + tiny village, repeat-x"}',
  '{"file":"stage3_courtyard_mid.png","layer":"mid","scrollFactor":0.60,"note":"old-house facade: grey tiled roof, white wall, red-couplet door, canopy top, repeat-x"}',
  '{"file":"stage3_courtyard_near.png","layer":"near","scrollFactor":0.85,"note":"trellis + stone bench + ground pots + petals, repeat-x"}'
)
$json2='{"layers":[' + ($m -join ",") + '],"meta":{"app":"FORGET-ME-NOT parallax by member-B","size":{"w":320,"h":180},"repeatX":true,"version":"1.4"}}'
[System.IO.File]::WriteAllText((Join-Path $psx "parallax.json"), $json2, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "parallax.json v1.4 OK (21 layers)"
