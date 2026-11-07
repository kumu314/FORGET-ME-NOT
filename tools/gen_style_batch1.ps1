# ============================================================
# FORGET-ME-NOT - Member B style alignment BATCH 1 (review only)
# Direction: dusk campus / cool shadows / deep blue outlines
# Palette law (from member-A measurements):
#   outline #101320 | deep shadows #171B2D #252B42 (cool-shifted)
#   warm light #FFD9A0 ONLY inside window panes
#   each material 3-4 steps (max 5), per-tile palette <= 20 colors
# Output: tools/_style_ref/out/  (scratch, not committed)
#   tile_*.png (16x16), tile_*_x8.png (128x128),
#   compare_batch1_x8.png (player frames + tiles side by side)
# Pure ASCII on purpose (PS 5.1 parses BOM-less files as ANSI).
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$ref  = Join-Path $root "tools\_style_ref"
$out  = Join-Path $ref "out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.IO;

public static class Gen3 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }

  // ---- shared style constants (member-A aligned) ----
  public static Color Outline  = From("#101320");
  public static Color DeepA    = From("#171B2D");
  public static Color DeepB    = From("#252B42");
  public static Color ShadowC  = From("#20283C");   // cool under-zone
  public static Color WarmLight= From("#FFD9A0");

  public class Px {
    public int W, H;
    public Color[,] c;
    public Px(int w, int h){ W=w; H=h; c=new Color[w,h];
      Color t=Color.FromArgb(0,0,0,0);
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) c[x,y]=t; }
    public bool In(int x,int y){ return x>=0 && y>=0 && x<W && y<H; }
    public void P(int x,int y,Color col){ if(In(x,y)) c[x,y]=col; }
    public void Fill(Color col){ for(int y=0;y<H;y++) for(int x=0;x<W;x++) c[x,y]=col; }
    public void R(int x,int y,int w,int h,Color col){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,col); }
    public void HL(int x,int y,int w,Color col){ R(x,y,w,1,col); }
    public void V(int x,int y,int h,Color col){ R(x,y,1,h,col); }
    public void Frame(int x,int y,int w,int h,Color col){
      HL(x,y,w,col); HL(x,y+h-1,w,col); V(x,y,h,col); V(x+w-1,y,h,col); }
    public int ColorCount(){
      HashSet<string> s=new HashSet<string>();
      for(int y=0;y<H;y++) for(int x=0;x<W;x++) s.Add(c[x,y].R+","+c[x,y].G+","+c[x,y].B+","+c[x,y].A);
      return s.Count; }
  }

  public static Px Scale(Px p,int f){
    Px o=new Px(p.W*f,p.H*f);
    for(int y=0;y<o.H;y++) for(int x=0;x<o.W;x++) o.c[x,y]=p.c[x/f,y/f];
    return o;
  }
  public static void Blit(Px dst,Px src,int ox,int oy){
    for(int y=0;y<src.H;y++) for(int x=0;x<src.W;x++){
      Color cc=src.c[x,y];
      if(cc.A>0 && dst.In(ox+x,oy+y)) dst.c[ox+x,oy+y]=cc;
    }
  }
  public static void SavePx(Px p, string path){
    using(Bitmap b=new Bitmap(p.W,p.H,PixelFormat.Format32bppArgb)){
      for(int y=0;y<p.H;y++) for(int x=0;x<p.W;x++) b.SetPixel(x,y,p.c[x,y]);
      b.Save(path, ImageFormat.Png);
    }
  }
  public static Px LoadFrames(string path, int fw, int fh, int count){
    Px p=new Px(fw*count, fh);
    using(Bitmap b=new Bitmap(path)){
      for(int f=0;f<count;f++)
        for(int y=0;y<fh;y++) for(int x=0;x<fw;x++){
          Color cc=b.GetPixel(f*fw+x, y);
          p.c[f*fw+x,y]=Color.FromArgb(cc.A,cc.R,cc.G,cc.B);
        }
    }
    return p;
  }

  // ================= BATCH 1 TILES (dusk campus / cool shadows) =================
  // ---- 1) wall_upper: warm plaster, 4 steps, cool AO at bottom, no outline ----
  public static Px WallUpper(){
    Px p=new Px(16,16);
    // dusk plaster: warm but dimmed, vertical 4-step ramp
    p.R(0,0,16,4,  From("#EBDAC0"));   // top-lit (dusk-dimmed)
    p.R(0,4,16,8,  From("#E0CCA8"));   // base
    p.R(0,12,16,3, From("#CDBA98"));   // lower falloff
    p.R(0,15,16,1, From("#A99D86"));   // AO where wall meets trim (cool-shifted)
    // subtle stains
    p.P(4,6,From("#DCC8A4")); p.P(5,6,From("#DCC8A4"));
    p.P(11,9,From("#C9B691"));
    p.P(2,12,From("#C9B691")); p.P(3,12,From("#C9B691"));
    return p;
  }

  // ---- 2) floor_a: warm plank floor, 5 colors, cool seams/AO ----
  public static Px FloorA(){
    Px p=new Px(16,16);
    p.R(0,0,16,7, From("#C9955C"));    // plank 1 base
    p.HL(0,0,16,   From("#E0B276"));   // plank 1 top light
    p.HL(0,7,16,   From("#5E5160"));   // seam (cool dark)
    p.R(0,8,16,7, From("#C08E56"));    // plank 2 base (half-step darker)
    p.HL(0,15,16,  From("#4A4356"));   // bottom seam AO (cool)
    // butt joints
    p.V(11,1,6, From("#5E5160"));
    p.V(4,8,7,  From("#5E5160"));
    // grain specks
    p.P(3,3,From("#B08050")); p.P(8,5,From("#B08050")); p.P(13,4,From("#E5BC80"));
    p.P(6,10,From("#AA7C4C")); p.P(10,12,From("#E5BC80")); p.P(1,12,From("#B08050"));
    // faint dusk sheen on plank2 top
    p.P(7,8,From("#D2A264")); p.P(8,8,From("#D2A264"));
    return p;
  }

  // ---- 3) desk_mid: outlined object, wood 3 steps + cool steel legs ----
  public static Px DeskMid(){
    Px p=new Px(16,16);
    // under-zone: deep cool shadow
    p.R(0,6,16,10, ShadowC);
    p.HL(0,15,16, From("#1A2030"));
    // legs (cool steel, outlined)
    p.R(2,7,3,8,  From("#3A3F52")); p.V(2,7,8,From("#4E5468"));
    p.Frame(2,7,3,8, Outline);
    p.R(11,7,3,8, From("#3A3F52")); p.V(11,7,8,From("#4E5468"));
    p.Frame(11,7,3,8, Outline);
    // crossbar
    p.R(6,10,5,2, From("#3A3F52")); p.HL(6,10,5,From("#4E5468"));
    p.Frame(6,10,5,2, Outline);
    // desktop slab (wood 3 steps) with outline box
    p.R(0,2,16,4, Outline);
    p.R(1,3,14,3, Outline);
    p.R(1,3,14,1, From("#E2B276"));    // top light
    p.R(1,4,14,1, From("#C08A54"));    // base
    p.R(1,5,14,1, From("#7A6256"));    // front edge (cool-shifted shadow)
    p.P(4,4,From("#A8764A")); p.P(9,4,From("#A8764A"));  // grain
    return p;
  }

  // ---- 4) window: dusk glass, warm light ONLY here; outlined wood frame ----
  public static Px Window(){
    Px p=new Px(16,16);
    // glass field (each pane gets vertical dusk ramp)
    Color g0=From("#6E5E8E");   // cool upper sky
    Color g1=From("#A87A78");   // mid dusk
    Color g2=From("#D89A6E");   // low warm
    Color g3=From("#E8A96E");   // horizon
    p.R(1,1,14,14, g3);
    p.R(1,1,14,4,  g0);
    p.R(1,5,14,4,  g1);
    p.R(1,9,14,3,  g2);
    // sun glow in top-left pane (the ONLY warm-light pixels on the wall row)
    p.R(3,2,2,2, WarmLight);
    p.P(5,2,From("#FFE8C0")); p.P(2,4,From("#FFE8C0")); p.P(5,4,From("#FFE8C0")); p.P(3,4,From("#FFE8C0")); p.P(4,4,From("#FFE8C0"));
    // cool sky reflection streak
    p.P(11,2,From("#C8BCD8")); p.P(12,3,From("#C8BCD8")); p.P(10,3,From("#C8BCD8"));
    // distant roofline silhouette in lower panes (cool dark)
    p.HL(2,12,5,  From("#3A3348"));
    p.HL(8,11,6,  From("#3A3348"));
    p.R(8,12,6,1, From("#3A3348"));
    p.R(2,13,12,1,From("#3A3348"));
    // wood muntins (cross) with right/bottom shading
    p.V(7,1,14, From("#6A4E38")); p.V(8,1,14, From("#4E4248"));
    p.HL(1,7,14, From("#6A4E38")); p.HL(1,8,14, From("#4E4248"));
    // wood frame ring (2px, light top-left / dark bottom-right)
    p.Frame(1,1,14,14, Outline);
    p.Frame(2,2,12,12, From("#7A5A40"));
    p.HL(2,2,12, From("#93704E"));
    p.V(2,2,12,  From("#93704E"));
    p.R(2,12,12,1,From("#4E4248"));
    p.V(12,2,12, From("#4E4248"));
    // outer outline
    p.Frame(0,0,16,16, Outline);
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- load player frames (24x24, sheet is 8 cols wide) ----
$playerPath = Join-Path $ref "player_youth.png"
$pf = [Gen3]::LoadFrames($playerPath, 24, 24, 4)   # frames 0..3 (idle)

# ---- build tiles ----
$wall  = [Gen3]::WallUpper()
$floor = [Gen3]::FloorA()
$desk  = [Gen3]::DeskMid()
$wind  = [Gen3]::Window()

# ---- save singles + x8 ----
$list = @(
  @{n="wall_upper"; p=$wall},
  @{n="floor_a";    p=$floor},
  @{n="desk_mid";   p=$desk},
  @{n="window";     p=$wind}
)
$report = New-Object System.Collections.Generic.List[string]
foreach($t in $list){
  [Gen3]::SavePx($t.p, (Join-Path $out ($t.n + ".png")))
  [Gen3]::SavePx([Gen3]::Scale($t.p, 8), (Join-Path $out ($t.n + "_x8.png")))
  $report.Add(($t.n + ": " + $t.p.ColorCount() + " colors"))
}

# ---- comparison sheet: player frames row + tiles row, x8 ----
$comp = New-Object Gen3+Px 112, 62
# background
for($y=0;$y -lt $comp.H;$y++){ for($x=0;$x -lt $comp.W;$x++){ $comp.c[$x,$y]=[Gen3]::From("#252B42") } }
# row 1: player frames at (2,2), each 24x24 with 2px gap
for($i=0;$i -lt 4;$i++){
  $src = New-Object Gen3+Px 24,24
  for($y=0;$y -lt 24;$y++){ for($x=0;$x -lt 24;$x++){ $ii=$i*24+$x; $src.c[$x,$y]=$pf.c[$ii,$y] } }
  [Gen3]::Blit($comp, $src, (2+$i*26), 2)
}
# row 2: tiles at (2,32), each 16x16 with 2px gap -> align columns with player frames above
for($i=0;$i -lt 4;$i++){
  [Gen3]::Blit($comp, $list[$i].p, (6+$i*26), 34)
}
[Gen3]::SavePx([Gen3]::Scale($comp, 8), (Join-Path $out "compare_batch1_x8.png"))
[Gen3]::SavePx($comp, (Join-Path $out "compare_batch1.png"))
$report.Add(("compare: " + $comp.ColorCount() + " colors (bg included)"))
[System.IO.File]::WriteAllLines((Join-Path $out "style_report.txt"), $report)
$report
Write-Host "BATCH1 DONE ->" $out
