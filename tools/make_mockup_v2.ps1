# Corridor mockup v2: refined sheet (50 frames incl. 5 new campus tiles) + eggs atlas
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tsDir= Join-Path $root "game\public\assets\tilesets"
$prev = Join-Path $tsDir "preview"

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
public static class G8 {
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
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
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) c[x,y]=Color.FromArgb(0,0,0,0); }
    public bool In(int x,int y){ return x>=0&&y>=0&&x<W&&y<H; }
    public void R(int x,int y,int w,int h,Color col){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,col); }
    public void P(int x,int y,Color col){ if(In(x,y)) c[x,y]=col; }
  }
}
"@
Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

$sheet  = [G8]::LoadPx((Join-Path $tsDir "school_corridor.png"))
$esheet = [G8]::LoadPx((Join-Path $tsDir "easter_eggs.png"))
$frames  = (Get-Content (Join-Path $tsDir "school_corridor.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$eframes = (Get-Content (Join-Path $tsDir "easter_eggs.json") -Raw -Encoding UTF8 | ConvertFrom-Json).frames
$cache=@{}
function T([string]$name,[int]$col,[int]$row){
  if(-not $cache.ContainsKey($name)){
    foreach($f in $frames){ if($f.filename -eq $name){ $cache[$name]=[G8]::Crop($sheet,$f.frame.x,$f.frame.y,$f.frame.w,$f.frame.h); break } }
    if(-not $cache.ContainsKey($name)){
      foreach($f in $eframes){ if($f.filename -eq $name){ $cache[$name]=[G8]::Crop($esheet,$f.frame.x,$f.frame.y,$f.frame.w,$f.frame.h); break } }
    }
    if(-not $cache.ContainsKey($name)){ throw "frame not found: $name" }
  }
  [G8]::Blit($S,$cache[$name],($col*16),($row*16))
}
$S = New-Object G8+Px 320,176
$S.R(0,0,320,10,[G8]::From("#FFE9B0")); $S.R(0,10,320,6,[G8]::From("#FDF0CC"))
for($c=0;$c -lt 20;$c++){
  T "floor_edge" $c 9
  if(($c % 3) -eq 2){ T "floor_b" $c 10 } else { T "floor_a" $c 10 }
}
T "floor_crack" 5 10; T "floor_crack" 12 10; T "floor_crack" 17 10
for($c=0;$c -lt 20;$c++){
  $ub="wall_upper"; if($c -eq 3){ $ub="wall_upper_b" }
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
T "plant" 0 8; T "trash_bin" 4 8; T "paper_scrap" 5 8; T "chalk_dust" 6 8; T "books_stack" 10 8
T "column_top" 2 6; T "column_body" 2 7; T "column_body" 2 8
T "column_top" 11 6; T "column_body" 11 7; T "column_body" 11 8
T "stairs_up" 13 8; T "stairs_down" 14 8
T "railing" 1 8; T "railing" 3 8
T "vine_ivy" 3 0; T "vine_ivy" 10 0; T "vine_ivy" 16 0
T "box_tremble_a" 19 8; T "bubble_wuu" 19 7
[G8]::SavePx([G8]::Scale($S,4),(Join-Path $prev "level1_corridor_mockup_v2_x4.png"))
Write-Host "mockup v2 OK"
