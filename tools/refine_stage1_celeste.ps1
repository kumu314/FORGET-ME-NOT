# ============================================================
# Stage-1 Celeste-style refinement + 5 new campus tile types
#  - detail pass on all 43 existing tiles (edge rims, cracks, AO)
#  - new: column_top, column_body, stairs_up, stairs_down,
#         railing, vine_ivy, floor_crack   (43 -> 50 frames)
#  - rebuild x4 sheet preview + corridor mockup v2
# Pure ASCII.
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tsDir= Join-Path $root "game\public\assets\tilesets"
$ref  = Join-Path $root "tools\_style_ref"
$outD = Join-Path $ref "out"
$prev = Join-Path $tsDir "preview"

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;

public static class Gen7 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
  public static Color Mix(Color a, Color b, double t){
    int r=(int)Math.Round(a.R+(b.R-a.R)*t);
    int g=(int)Math.Round(a.G+(b.G-a.G)*t);
    int bl=(int)Math.Round(a.B+(b.B-a.B)*t);
    return Color.FromArgb(a.A,r,g,bl);
  }
  public static Color White(Color c,double t){ return Mix(c,Color.FromArgb(c.A,255,255,255),t); }
  public static Color Black(Color c,double t){ return Mix(c,Color.FromArgb(c.A,12,15,24),t); }

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

  static int Seed(int s){ return (int)((long)s*2654435761L+1013904223L); }

  // Celeste-style detailing on one 16x16 tile
  public static void Detail(Px t, string role, int seed){
    int s=seed;
    if(role=="ground"||role=="platform"){
      for(int x=0;x<16;x++){ t.c[x,0]=White(t.c[x,0],0.20); t.c[x,1]=White(t.c[x,1],0.08); }
      for(int x=0;x<16;x++) t.c[x,15]=Black(t.c[x,15],0.22);
      for(int k=0;k<3;k++){
        s=Seed(s); int rx=2+((s>>12)&13);
        s=Seed(s); int ry=3+((s>>16)&11);
        t.P(rx,ry,Black(t.c[rx,ry],0.30));
      }
      s=Seed(s); int cx=1+((s>>12)&13); s=Seed(s); int cy=2+((s>>16)&12);
      t.P(cx,cy,White(t.c[cx,cy],0.15));
    } else if(role=="breakable"){
      for(int x=0;x<16;x++) t.c[x,15]=Black(t.c[x,15],0.16);
      int[] dx={4,5,6,7,10,11}; int[] dy={5,6,7,8,6,7};
      for(int k=0;k<6;k++) t.P(dx[k],dy[k],Black(t.c[dx[k],dy[k]],0.32));
    } else { // decor
      for(int x=0;x<16;x++){ t.c[x,15]=Black(t.c[x,15],0.14); t.c[x,0]=White(t.c[x,0],0.06); }
    }
  }

  // ===== new campus tiles =====
  public static Px ColumnTop(){
    Px p=new Px(16,16);
    p.R(0,0,16,3, From("#D8B88E"));
    p.HL(0,0,16, From("#EEDCBB"));
    p.HL(0,2,16, From("#B89A72"));
    p.R(3,3,10,2, From("#E0CBA4"));
    p.R(2,5,12,11, From("#E0CBA4"));
    p.V(2,5,11, From("#C4B090"));
    p.V(13,5,11, From("#C4B090"));
    p.V(6,5,3, From("#F2E4C4"));
    p.V(7,5,3, From("#E6D2AC"));
    p.P(5,9,From("#B89A72")); p.P(11,13,From("#B89A72"));
    return p;
  }
  public static Px ColumnBody(){
    Px p=new Px(16,16);
    p.R(2,0,12,16, From("#E0CBA4"));
    p.V(2,0,16, From("#C4B090"));
    p.V(13,0,16, From("#C4B090"));
    p.V(6,0,3, From("#F2E4C4"));
    p.V(7,0,3, From("#E6D2AC"));
    p.HL(0,7,16, From("#D2BD98"));
    p.HL(0,8,16, From("#C9B48E"));
    p.P(4,3,From("#B89A72")); p.P(11,12,From("#B89A72"));
    p.P(9,5,From("#EEDCBB"));
    return p;
  }
  public static Px StairsUp(){
    Px p=new Px(16,16);
    p.R(0,0,16,5, From("#E8B878"));
    p.HL(0,0,16, From("#F2CC8E"));
    p.HL(0,5,16, From("#B08050"));
    p.R(0,6,16,10, From("#C08858"));
    p.HL(0,6,16, From("#D09868"));
    p.V(5,6,10, From("#A87448"));
    p.V(11,6,10, From("#A87448"));
    p.HL(0,15,16, From("#8A6040"));
    p.P(3,10,From("#D09868")); p.P(13,12,From("#A87448"));
    return p;
  }
  public static Px StairsDown(){
    Px p=new Px(16,16);
    p.R(0,0,16,5, From("#E8B878"));
    p.HL(0,0,16, From("#F2CC8E"));
    p.HL(0,5,16, From("#B08050"));
    p.V(15,0,16, From("#A87448"));
    p.R(0,6,16,10, From("#C08858"));
    p.HL(0,6,16, From("#D09868"));
    p.V(4,6,10, From("#A87448"));
    p.V(10,6,10, From("#A87448"));
    p.HL(0,15,16, From("#8A6040"));
    p.P(2,11,From("#D09868")); p.P(8,9,From("#A87448"));
    return p;
  }
  public static Px Railing(){
    Px p=new Px(16,16);
    p.R(0,4,16,3, From("#8C98A2"));
    p.HL(0,4,16, From("#C4CED6"));
    p.HL(0,6,16, From("#5F6A72"));
    p.R(0,10,16,2, From("#8C98A2"));
    p.HL(0,10,16, From("#A8B2BA"));
    p.V(3,4,9, From("#6E7880"));
    p.V(8,4,9, From("#6E7880"));
    p.V(13,4,9, From("#6E7880"));
    p.V(0,4,12, From("#7A848C"));
    p.V(15,4,12, From("#7A848C"));
    p.P(3,3,From("#C4CED6")); p.P(13,3,From("#C4CED6"));
    return p;
  }
  public static Px VineIvy(){
    Px p=new Px(16,16);
    p.V(4,0,7, From("#4E8842"));
    p.V(9,0,10, From("#4E8842"));
    p.V(13,0,5, From("#4E8842"));
    p.P(3,4,From("#6AA85A")); p.P(5,6,From("#6AA85A"));
    p.P(8,8,From("#6AA85A")); p.P(10,3,From("#6AA85A"));
    p.P(12,7,From("#6AA85A")); p.P(14,2,From("#6AA85A"));
    p.P(7,12,From("#6AA85A")); p.P(10,13,From("#6AA85A"));
    p.P(4,3,From("#8CC878")); p.P(9,5,From("#8CC878"));
    p.P(13,4,From("#8CC878")); p.P(10,10,From("#8CC878"));
    p.P(5,10,From("#3C6E34")); p.P(11,15,From("#3C6E34"));
    return p;
  }
  public static Px FloorCrack(Px floorA){
    Px p=floorA;
    int[] cx={3,4,5,6,7,8,9,10,11,11};
    int[] cy={2,3,3,4,5,6,7,8,9,10};
    for(int k=0;k<cx.Length;k++) p.P(cx[k],cy[k],From("#5E5160"));
    p.P(5,3,From("#4A4356")); p.P(8,6,From("#4A4356")); p.P(11,9,From("#4A4356"));
    p.P(4,4,From("#E5BC80")); p.P(9,6,From("#E5BC80"));
    p.P(13,12,From("#5E5160")); p.P(14,13,From("#5E5160"));
    return p;
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ---- load sheet + atlas ----
$sheet = [Gen7]::LoadPx((Join-Path $tsDir "school_corridor.png"))
$atlas = Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$frames = $atlas.frames

# ---- Celeste detail pass on existing 43 tiles ----
$i = 0
foreach($f in $frames){
  $x=$f.frame.x; $y=$f.frame.y
  $tile=[Gen7]::Crop($sheet,$x,$y,16,16)
  [Gen7]::Detail($tile, $f.meta.role, 1000+$i*97)
  [Gen7]::Blit($sheet,$tile,$x,$y)
  $i++
}
Write-Host ("detail pass done on " + $i + " tiles")

# ---- 5 new campus tile types (7 frames) appended ----
$fa = [Gen7]::Crop($sheet,0,0,16,16)   # floor_a as crack base
$newTiles = @(
  @{n="column_top";  p=[Gen7]::ColumnTop();  role="decor";  solid=$false; note="teaching-building pilaster capital, stack on column_body"},
  @{n="column_body"; p=[Gen7]::ColumnBody(); role="decor";  solid=$false; note="pilaster shaft, repeat vertically to floor"},
  @{n="stairs_up";   p=[Gen7]::StairsUp();   role="platform"; solid=$true; note="stair step rising to the right, riser on left"},
  @{n="stairs_down"; p=[Gen7]::StairsDown(); role="platform"; solid=$true; note="stair step descending to the right, riser on right"},
  @{n="railing";     p=[Gen7]::Railing();    role="decor";  solid=$false; note="stairwell railing, see-through, decor row above ground"},
  @{n="vine_ivy";    p=[Gen7]::VineIvy();    role="decor";  solid=$false; note="ivy strands hanging from ceiling / beam top"},
  @{n="floor_crack"; p=[Gen7]::FloorCrack($fa); role="ground"; solid=$true; note="cracked floor variant, sprinkle 1 per 6-8 ground tiles"}
)
$idx = $frames.Count
$newFrames = New-Object System.Collections.Generic.List[object]
foreach($t in $newTiles){
  $x=($idx % 16)*16; $y=[math]::Floor($idx/16)*16
  [Gen7]::Blit($sheet,$t.p,$x,$y)
  $frames += [pscustomobject]@{ filename=$t.n; frame=[pscustomobject]@{x=$x;y=$y;w=16;h=16}; rotated=$false; trimmed=$false; spriteSourceSize=[pscustomobject]@{x=0;y=0;w=16;h=16}; sourceSize=[pscustomobject]@{w=16;h=16}; meta=[pscustomobject]@{role=$t.role;solid=$t.solid;note=$t.note} }
  Write-Host ("new tile: " + $t.n + " at " + $x + "," + $y)
  $idx++
}

# ---- save sheet + rebuilt json ----
[Gen7]::SavePx($sheet,(Join-Path $tsDir "school_corridor.png"))
$outFrames = New-Object System.Collections.Generic.List[string]
foreach($f in $frames){
  $j = '{{"filename":"{0}","frame":{{"x":{1},"y":{2},"w":{3},"h":{4}}},"rotated":false,"trimmed":false,"spriteSourceSize":{{"x":0,"y":0,"w":{3},"h":{4}}},"sourceSize":{{"w":{3},"h":{4}}},"meta":{{"role":"{5}","solid":{6},"note":"{7}"}}}}' -f $f.filename,$f.frame.x,$f.frame.y,$f.frame.w,$f.frame.h,$f.meta.role,($f.meta.solid.ToString().ToLower()),$f.meta.note
  $outFrames.Add($j)
}
$json = '{"frames":[' + ($outFrames -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"school_corridor.png","format":"RGBA8888","size":{"w":256,"h":256},"scale":"1","tileSize":16,"version":"1.2"}}'
[System.IO.File]::WriteAllText((Join-Path $tsDir "school_corridor.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("sheet+json saved, frames=" + $frames.Count)

# ---- x4 sheet preview ----
[Gen7]::SavePx([Gen7]::Scale($sheet,4),(Join-Path $prev "school_corridor_sheet_x4.png"))

# ---- corridor mockup v2 (320x176, adds new tiles) ----
function Frame-Of([string]$name){
  foreach($f in $frames){ if($f.filename -eq $name){ return [Gen7]::Crop($sheet,$f.frame.x,$f.frame.y,16,16) } }
  throw "frame not found: $name"
}
$S = New-Object Gen7+Px 320,176
$S.R(0,0,320,10,[Gen7]::From("#FFE9B0")); $S.R(0,10,320,6,[Gen7]::From("#FDF0CC"))
$t={}
foreach($n in @("floor_edge","floor_a","floor_b","floor_crack","wall_upper","wall_upper_b","wall_trim","wall_lower","wall_base","bb_tl","bb_tm","bb_tr","bb_ml","bb_mm","bb_mr","bb_bl","bb_bm","bb_br","beam","wall_clock","honor_roll","banner_red","window","windowsill","door_top","door_bottom","bb_sealed","podium_top","podium_base","desk_left","desk_mid","desk_right","desk_single","plant","trash_bin","paper_scrap","chalk_dust","books_stack","locker_tl","locker_tr","locker_bl","locker_br","column_top","column_body","stairs_up","stairs_down","railing","vine_ivy","answer_card_a","box_tremble_a","bubble_wuu")){
  # stash frames in a hashtable via Frame-Of on demand instead
}
$cache=@{}
function T([string]$name,[int]$col,[int]$row){
  if(-not $cache.ContainsKey($name)){ $cache[$name]=Frame-Of $name }
  [Gen7]::Blit($S,$cache[$name],($col*16),($row*16))
}
for($c=0;$c -lt 20;$c++){
  T "floor_edge" $c 9
  if(($c % 3) -eq 2){ T "floor_b" $c 10 } else { T "floor_a" $c 10 }
}
T "floor_crack" 5 10; T "floor_crack" 12 10; T "floor_crack" 17 10
for($c=0;$c -lt 20;$c++){
  $ub="wall_upper"; if(($c -eq 3 -or $c -eq 8) -and $true){ if($c -eq 3){ $ub="wall_upper_b" } }
  T $ub $c 0; T "wall_upper" $c 1; T "wall_upper" $c 2; T "wall_upper" $c 3; T "wall_upper" $c 4
  T "wall_trim" $c 5
  T "wall_lower" $c 6
  T "wall_lower" $c 7
  T "wall_base" $c 8
}
T "bb_tl" 6 2; T "bb_tm" 7 2; T "bb_tr" 8 2
T "bb_ml" 6 3; T "bb_mm" 7 3; T "bb_mr" 8 3
T "bb_bl" 6 4; T "bb_bm" 7 4; T "bb_br" 8 4
T "beam" 5 1; T "beam" 6 1; T "beam" 7 1; T "beam" 8 1; T "beam" 9 1
T "answer_card_a" 7 0
T "bb_sealed" 10 4
T "window" 13 2; T "windowsill" 13 3
T "window" 15 2; T "windowsill" 15 3
T "honor_roll" 12 2
T "wall_clock" 17 2
T "banner_red" 2 1; T "banner_red" 3 1; T "banner_red" 4 1
T "door_top" 18 7; T "door_bottom" 18 8
T "locker_tl" 15 7; T "locker_tr" 16 7; T "locker_bl" 15 8; T "locker_br" 16 8
T "podium_top" 9 7; T "podium_base" 9 8
T "desk_left" 11 8; T "desk_mid" 12 8
T "desk_single" 17 8
T "plant" 0 8; T "trash_bin" 4 8; T "paper_scrap" 5 8; T "chalk_dust" 10 8; T "books_stack" 14 8
# --- new campus tiles showcased ---
T "column_top" 2 6; T "column_body" 2 7; T "column_body" 2 8
T "column_top" 11 6; T "column_body" 11 7; T "column_body" 11 8
T "stairs_up" 13 8; T "stairs_down" 14 8
T "railing" 1 8; T "railing" 3 8
T "vine_ivy" 3 0; T "vine_ivy" 10 0; T "vine_ivy" 16 0
T "box_tremble_a" 19 8; T "bubble_wuu" 19 7
[Gen7]::SavePx([Gen7]::Scale($S,4),(Join-Path $prev "level1_corridor_mockup_v2_x4.png"))
Write-Host "mockup v2 OK"
