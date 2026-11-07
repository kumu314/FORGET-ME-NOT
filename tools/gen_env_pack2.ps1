# ============================================================
# FORGET-ME-NOT - Member B environment pack 2
#  - Level 2 office tileset  : game/public/assets/tilesets/office_rain.png  (+ json)
#  - Level 3 home tileset    : game/public/assets/tilesets/home_autumn.png  (+ json)
#  - Parallax layers (3 stages): game/public/assets/parallax/*.png + parallax.json
#  - Composite mockups       : */preview/*.png
# Style note: richer ramps (5 tones), per-row gradient dither, AO shadows.
# Pure ASCII on purpose (PS 5.1 parses BOM-less files as ANSI).
# ============================================================
$ErrorActionPreference = "Stop"
$root  = Split-Path -Parent $PSScriptRoot
$tset  = Join-Path $root "game\public\assets\tilesets"
$psx   = Join-Path $root "game\public\assets\parallax"
New-Item -ItemType Directory -Force -Path $tset | Out-Null
New-Item -ItemType Directory -Force -Path $psx | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tset "preview") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $psx "preview") | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.IO;
using System.Text;

public static class Gen2 {
  // ---------- generic helpers ----------
  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }
  public static Color Lerp(Color a, Color b, double t){
    int r=(int)Math.Round(a.R+(b.R-a.R)*t);
    int g=(int)Math.Round(a.G+(b.G-a.G)*t);
    int bl=(int)Math.Round(a.B+(b.B-a.B)*t);
    return Color.FromArgb(255,r,g,bl);
  }

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
    public void Grad(int x,int y,int w,int h,Color ca,Color cb){
      for(int j=0;j<h;j++){ double t=(h<=1)?0:(double)j/(h-1);
        Color cc=Lerp(ca,cb,t);
        for(int i=0;i<w;i++) P(x+i,y+j,cc); } }
    public void Dith(int x,int y,int w,int h,Color a,Color b){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,((i+j)&1)==0?a:b); }
    public void Speck(int x,int y,int w,int h,Color col,int count,int seed){
      int s=seed;
      for(int k=0;k<count;k++){
        s=s*1103515245+12345; int rx=((s>>16)&0x7fff)%w;
        s=s*1103515245+12345; int ry=((s>>16)&0x7fff)%h;
        P(x+rx,y+ry,col); } }
    public Px Clone(){ Px p=new Px(W,H); for(int y=0;y<H;y++) for(int x=0;x<W;x++) p.c[x,y]=c[x,y]; return p; }
  }

  public static Px WrapDiag(Px p, int x, int y, int len, Color col, int slant){
    // vertical-ish streak slanting left, x wrapped at canvas edge
    for(int i=0;i<len;i++){
      int xx=((x - i/slant)%p.W + p.W)%p.W;
      p.P(xx, y+i, col);
    }
    return p;
  }

  public static Dictionary<string,Px> Split3x3(Px src, string prefix){
    var d=new Dictionary<string,Px>();
    string[] sfx={"tl","tm","tr","ml","mm","mr","bl","bm","br"};
    for(int i=0;i<9;i++){ int cx=(i%3)*16, cy=(i/3)*16;
      Px t=new Px(16,16);
      for(int y=0;y<16;y++) for(int x=0;x<16;x++) t.c[x,y]=src.c[cx+x,cy+y];
      d[prefix+"_"+sfx[i]]=t; }
    return d;
  }
  public static Dictionary<string,Px> Split2x2(Px src, string prefix){
    var d=new Dictionary<string,Px>();
    string[] sfx={"tl","tr","bl","br"};
    for(int i=0;i<4;i++){ int cx=(i%2)*16, cy=(i/2)*16;
      Px t=new Px(16,16);
      for(int y=0;y<16;y++) for(int x=0;x<16;x++) t.c[x,y]=src.c[cx+x,cy+y];
      d[prefix+"_"+sfx[i]]=t; }
    return d;
  }

  // ================= LEVEL 2 : OFFICE =================
  static Color C(string h){ return From(h); }

  public static Px CarpetA(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#5f6f80"), C("#52616f"));
    p.Speck(0,0,16,16, C("#6e7e8e"), 14, 11);
    p.Speck(0,0,16,16, C("#48586a"), 10, 22);
    p.HL(0,15,16, C("#455460"));
    p.P(4,8,C("#7a8a98")); p.P(11,3,C("#7a8a98"));
    return p;
  }
  public static Px CarpetB(){
    Px p=CarpetA();
    p.Speck(0,0,16,16, C("#41505e"), 8, 33);
    p.HL(3,2,7,C("#48586a")); p.V(3,2,4,C("#48586a"));  // worn patch
    p.Speck(0,0,16,16, C("#78889a"), 6, 44);
    return p;
  }
  public static Px CarpetEdge(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#6a7a8c"), C("#546476"));
    p.HL(0,0,16, C("#8c9caa")); p.HL(0,1,16, C("#7c8c9a"));
    p.Speck(0,2,16,14, C("#5e6e80"), 10, 55);
    p.R(0,14,16,2, C("#3e4d5c"));
    return p;
  }
  public static Px CarpetDark(){
    Px p=new Px(16,16);
    p.Fill(C("#3c4a58"));
    p.Speck(0,0,16,16, C("#34424e"), 12, 66);
    p.HL(0,0,16, C("#48586a"));
    return p;
  }
  public static Px WetFloor(int seed){
    Px p=new Px(16,16);
    p.Fill(C("#2c3a4e"));
    p.V(4,0,16, C("#3a4a62")); p.V(5,0,16, C("#46586e"));
    p.V(10,0,16, C("#3a4a62"));
    p.Speck(0,0,16,16, C("#54687e"), 6, seed);
    p.HL(0,15,16, C("#243044"));
    return p;
  }
  public static Px WallOffice(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#d8d2c4"), C("#c8c2b2"));
    p.V(0,0,16, C("#bcb6a6"));                        // panel seam
    p.HL(0,7,16, C("#c2bcac"));
    return p;
  }
  public static Px WallOfficeB(){
    Px p=WallOffice();
    p.Speck(0,0,16,16, C("#b8b2a2"), 6, 77);
    p.R(5,9,6,4, C("#cec8b8"));
    return p;
  }
  public static Px CeilingPlain(){
    Px p=new Px(16,16);
    p.Fill(C("#9aa0a6"));
    p.HL(0,0,16, C("#888e94")); p.V(0,0,16, C("#888e94"));
    p.HL(0,15,16, C("#aeb4ba")); p.V(15,0,16, C("#aeb4ba"));
    p.Speck(0,1,15,14, C("#a4aaB0".ToLower()), 8, 88);
    return p;
  }
  public static Px CeilingLight(){
    Px p=new Px(16,16);
    p.Fill(C("#8a9096"));
    p.HL(0,0,16, C("#767c82")); p.V(0,0,16, C("#767c82"));
    p.R(2,3,12,10, C("#eef2f0"));
    p.R(2,3,12,1, C("#d0d6d2"));
    p.R(2,12,12,1, C("#d0d6d2"));
    p.Dith(3,4,10,8, C("#ffffff"), C("#e2ece8"));
    p.HL(4,7,8, C("#ffffff"));
    p.R(1,2,14,1, C("#9aa0a6")); p.R(1,13,14,1, C("#9aa0a6"));
    return p;
  }
  public static Px PartitionTop(){
    Px p=new Px(16,16);
    p.R(0,0,16,3, C("#c4ccd2"));
    p.HL(0,0,16, C("#dce4ea")); p.HL(0,2,16, C("#9aa4ac"));
    p.R(0,3,16,13, C("#52708c"));
    p.HL(0,3,16, C("#64829e"));
    p.Speck(0,4,16,12, C("#48647e"), 12, 99);
    p.Speck(0,4,16,12, C("#5e7c96"), 8, 111);
    return p;
  }
  public static Px PartitionBody(){
    Px p=new Px(16,16);
    p.Fill(C("#4e6c88"));
    p.HL(0,0,16, C("#5e7c98"));
    p.Speck(0,0,16,16, C("#44607a"), 16, 122);
    p.Speck(0,0,16,16, C("#5a7892"), 10, 133);
    p.HL(0,15,16, C("#3c5468"));
    return p;
  }
  public static Px Desk(int mode){ // 0 mid, 1 left, 2 right, 3 monitor, 4 single
    Px p=new Px(16,16);
    Color top =C("#d9cfb8"), topHi=C("#e8dfc9"), topDk=C("#b0a68e");
    Color leg =C("#3e4a56"), legHi=C("#55626e"), metal=C("#8c98a2");
    p.R(0,3,16,3, top);
    p.HL(0,3,16, topHi);
    p.HL(0,5,16, topDk);
    p.R(0,6,16,2, C("#8c8674"));
    if(mode==1){ p.V(0,3,3,topDk); p.R(1,8,4,8,leg); p.HL(1,8,4,legHi); }
    if(mode==2){ p.V(15,3,3,topDk); p.R(11,8,4,8,leg); p.HL(11,8,4,legHi); }
    if(mode==4){ p.V(0,3,3,topDk); p.V(15,3,3,topDk); p.R(1,8,4,8,leg); p.R(11,8,4,8,leg); }
    if(mode==0||mode==3){ p.R(5,8,1,6,leg); p.R(10,8,1,6,leg); }
    if(mode==0){ p.R(6,8,4,2,metal); }
    if(mode==3){ // CRT monitor glowing
      p.R(4,0,8,3, C("#c8ccd0"));
      p.R(5,1,6,2, C("#1e2c3c"));
      p.R(5,1,6,1, C("#2c4258"));
      p.P(6,1,C("#5ec8e8")); p.P(8,2,C("#9adcF0".ToLower()));
      p.R(7,3,2,1, C("#a8acb0"));
      p.Speck(0,4,16,2, topHi, 4, 144);
    }
    if(mode==4){ // papers + mug on single desk
      p.R(4,1,5,2, C("#f2efe4")); p.P(4,1,C("#dcd8ca"));
      p.R(10,1,2,2, C("#c0392b")); p.P(10,1,C("#e05a4a"));
    }
    return p;
  }
  public static Px PrinterBig(){
    Px p=new Px(32,32);
    // body
    p.R(1,6,30,24, C("#d4d0c4"));
    p.R(1,6,30,2, C("#e4e0d4"));
    p.R(1,28,30,2, C("#a09c90"));
    p.R(1,6,2,24, C("#e0dcd0")); p.R(29,6,2,24, C("#b0aca0"));
    p.R(1,28,30,1, C("#787468"));
    // scanner lid line
    p.HL(3,9,26, C("#b8b4a8"));
    p.R(4,10,24,2, C("#c8c4b8"));
    // control panel + green LCD
    p.R(20,13,9,6, C("#c4c0b4"));
    p.R(21,14,4,2, C("#3a8a3a"));
    p.R(21,14,4,1, C("#9ce89c"));
    p.P(26,14,C("#8a867c")); p.P(27,14,C("#8a867c"));
    p.P(26,15,C("#8a867c")); p.P(27,15,C("#8a867c"));
    // paper trays
    p.R(4,14,10,7, C("#c0bcb0"));
    p.R(4,14,10,1, C("#e0dcd0"));
    p.R(5,15,8,1, C("#f2efe4"));
    p.R(4,18,10,1, C("#9a968a"));
    // output slot with paper
    p.R(8,22,16,3, C("#8a867c"));
    p.R(9,21,14,1, C("#f2efe4"));
    p.R(11,20,8,1, C("#f7f4ea"));
    // paper jam panel (breakable-ish detail)
    p.R(24,22,5,4, C("#c4c0b4"));
    p.P(26,23,C("#c0392b"));
    // feet + shadow
    p.R(2,30,4,2, C("#5a564c")); p.R(26,30,4,2, C("#5a564c"));
    p.HL(0,31,32, Color.FromArgb(90,20,26,34));
    return p;
  }
  public static Px Vending(bool top){
    Px p=new Px(16,16);
    if(top){
      p.R(1,0,14,16, C("#3a5a8c"));
      p.R(1,0,14,2, C("#4a6ca0"));
      p.V(1,0,16, C("#4a6ca0")); p.V(14,0,16, C("#2c4870"));
      p.R(3,2,10,9, C("#dceef8"));
      p.R(3,2,10,1, C("#f2faff"));
      // item rows
      for(int i=0;i<4;i++){ p.R(4,3+i*2,2,1, C(i%2==0?"#e05a4a":"#f0b04a")); p.R(8,3+i*2,2,1, C(i%2==0?"#5ec8e8":"#9ae05a")); }
      p.R(3,11,10,1, C("#8ab0c8"));
      p.HL(0,15,16, C("#22385c"));
    } else {
      p.R(1,0,14,13, C("#3a5a8c"));
      p.R(3,1,10,6, C("#dceef8"));
      p.R(3,1,10,1, C("#f2faff"));
      p.Speck(4,2,8,4, C("#b8d8ea"), 6, 155);
      p.R(3,8,4,4, C("#2c4870"));          // coin slot panel
      p.P(4,9,C("#f0d060"));
      p.R(9,8,4,4, C("#1e3048"));
      p.R(11,12,3,2, C("#c8d4dc"));        // pickup flap
      p.V(1,0,13, C("#4a6ca0")); p.V(14,0,13, C("#2c4870"));
      p.R(1,13,14,3, C("#22385c"));
      p.HL(1,13,14, C("#4a6ca0"));
      p.HL(0,15,16, Color.FromArgb(90,16,22,32));
    }
    return p;
  }
  public static Px Blinds(bool closed){
    Px p=new Px(16,16);
    // outer frame + night glass base
    p.Fill(C("#5a6a76"));
    p.R(1,1,14,14, C("#1e2e44"));
    if(closed){
      for(int y=2;y<14;y+=2){
        p.HL(1,y,14, C("#c2ced6"));
        p.HL(1,y+1,14, C("#8a98a4"));
      }
      p.R(1,1,14,1, C("#d2dee6"));
    } else {
      // slats raised to top third
      p.R(1,1,14,4, C("#c2ced6"));
      p.HL(1,1,14, C("#d2dee6"));
      p.HL(1,4,14, C("#8a98a4"));
      // open glass: city dots
      p.P(4,8,C("#ffd98a")); p.P(5,8,C("#ffd98a"));
      p.P(9,10,C("#9fd8ff"));
      p.P(12,7,C("#ffd98a"));
      p.P(7,12,C("#e8f4ff"));
    }
    p.R(1,14,14,1, C("#485864"));
    return p;
  }
  public static Px GlassWall(int seed){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#182842"), C("#22334e"));
    // distant lit windows dots
    p.Speck(0,0,16,16, C("#ffd98a"), 3, seed);
    p.Speck(0,0,16,16, C("#9fd8ff"), 2, seed+7);
    p.Speck(0,0,16,16, C("#31465e"), 8, seed+13);
    // rain streaks on glass
    p.V(3,0,10, C("#3c5470"));
    p.V(4,2,8, C("#546e8a"));
    p.V(11,4,12, C("#3c5470"));
    p.P(11,3,C("#6a86a6"));
    // floor reflection band at tile bottom
    p.R(0,14,16,2, C("#2a3c56"));
    p.V(5,14,2, C("#42586e"));
    return p;
  }
  public static Px Mullion(){
    Px p=new Px(16,16);
    p.Fill(C("#141e2c"));
    p.R(4,0,8,16, C("#222e40"));
    p.R(6,0,2,16, C("#38485e"));
    p.R(7,0,1,16, C("#4c5c72"));
    p.HL(4,0,8, C("#2e3c50"));
    p.R(0,0,2,16, C("#1a2434"));
    return p;
  }
  public static Px Elevator(){
    Px p=new Px(16,16);
    p.R(1,0,14,16, C("#98a2aa"));
    p.V(1,0,16, C("#b4bec4")); p.V(14,0,16, C("#78828a"));
    p.V(7,0,16, C("#5f6a72")); p.V(8,0,16, C("#6e7880"));  // center seam
    p.V(3,0,16, C("#a8b2b8")); p.V(12,0,16, C("#88929a"));
    p.R(11,4,3,4, C("#78706a"));                            // call panel
    p.P(12,5,C("#e8a23c"));
    p.HL(1,0,14, C("#c4ced4"));
    p.R(1,15,14,1, C("#5a646c"));
    return p;
  }
  public static Px PaperPile(){
    Px p=new Px(16,16);
    p.R(3,8,10,4, C("#f2efe4"));
    p.R(3,8,10,1, C("#ffffff"));
    p.R(3,11,10,1, C("#d4d0c0"));
    p.R(5,5,8,3, C("#e8e4d6"));
    p.R(5,5,8,1, C("#f7f4ea"));
    p.R(7,2,5,3, C("#f2efe4"));
    p.R(8,3,3,1, C("#c0392b"));
    p.P(6,6,C("#8a9ab0")); p.P(9,9,C("#8a9ab0"));
    p.HL(3,12,10, Color.FromArgb(80,20,26,34));
    return p;
  }
  public static Px ChairOffice(){
    Px p=new Px(16,16);
    p.R(3,1,10,7, C("#2e3e50"));
    p.R(4,2,8,5, C("#3c5064"));
    p.R(4,2,8,1, C("#4e6276"));
    p.R(2,8,12,2, C("#26364a"));
    p.V(7,10,2, C("#55626e"));
    p.R(3,12,3,1, C("#8c98a2")); p.R(10,12,3,1, C("#8c98a2"));
    p.R(2,13,5,2, C("#3e4a56")); p.R(9,13,5,2, C("#3e4a56"));
    p.HL(2,15,12, Color.FromArgb(80,16,22,32));
    return p;
  }
  public static Px BinOffice(){
    Px p=new Px(16,16);
    p.R(4,2,8,2, C("#8c98a2"));
    p.HL(4,2,8, C("#aeb8c0"));
    p.R(3,4,10,10, C("#6a7884"));
    p.V(3,4,10, C("#57646e")); p.V(12,4,10, C("#4e5a64"));
    // mesh holes
    p.Speck(4,5,8,8, C("#4a5660"), 8, 166);
    p.P(5,6,C("#8c98a2")); p.P(9,8,C("#8c98a2")); p.P(6,10,C("#8c98a2"));
    p.R(3,14,10,1, C("#3e4a54"));
    p.HL(3,15,10, Color.FromArgb(80,16,22,32));
    // crumpled paper overflow
    p.R(6,0,4,2, C("#f2efe4")); p.P(6,0,C("#dcd8ca"));
    return p;
  }
  public static Px BoxKpi(){
    Px p=new Px(16,16);
    p.R(2,5,12,10, C("#b89a6e"));
    p.R(2,5,12,1, C("#c9ac80"));
    p.R(2,14,12,1, C("#96794e"));
    p.V(2,5,10, C("#c9ac80")); p.V(13,5,10, C("#9e8155"));
    p.R(1,3,6,2, C("#a8895e")); p.R(9,3,6,2, C("#a8895e"));
    p.R(7,5,2,10, C("#e0d4b4"));
    // red KPI stamp
    p.R(4,8,3,3, C("#c0392b"));
    p.R(9,9,4,1, C("#6a5a3e")); p.R(9,11,3,1, C("#6a5a3e"));
    // paper sticking out
    p.R(5,1,4,2, C("#f2efe4")); p.P(8,1,C("#dcd8ca"));
    p.HL(2,15,12, Color.FromArgb(80,16,22,32));
    return p;
  }
  public static Px CableFloor(){
    Px p=new Px(16,16);
    p.P(2,10,C("#3e4a56")); p.P(3,10,C("#4e5a66")); p.P(4,11,C("#4e5a66"));
    p.P(5,11,C("#4e5a66")); p.P(6,10,C("#4e5a66")); p.P(7,10,C("#4e5a66"));
    p.P(8,11,C("#4e5a66")); p.P(9,12,C("#4e5a66")); p.P(10,12,C("#3e4a56"));
    p.P(11,11,C("#4e5a66")); p.P(12,10,C("#4e5a66")); p.P(13,10,C("#3e4a56"));
    p.P(5,12,C("#2e3a46")); p.P(9,13,C("#2e3a46"));
    return p;
  }

  // ================= LEVEL 3 : HOME / AUTUMN =================
  public static Px WoodA(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#c09263"), C("#b08151"));
    p.HL(0,0,16, C("#cf9f6e"));
    p.HL(0,7,16, C("#8a6238"));                     // plank seam
    p.HL(0,15,16, C("#7d5735"));
    p.P(3,3,C("#a87a4c")); p.P(4,3,C("#a87a4c"));
    p.P(10,5,C("#a87a4c")); p.P(11,10,C("#8a6238"));
    p.P(6,12,C("#a87a4c")); p.P(13,3,C("#d8a878"));
    return p;
  }
  public static Px WoodB(){
    Px p=WoodA();
    p.P(5,2,C("#8a6238")); p.P(6,2,C("#8a6238")); p.P(7,3,C("#8a6238"));
    p.Speck(0,0,16,16, C("#a87a4c"), 5, 177);
    p.P(12,8,C("#d8a878"));
    return p;
  }
  public static Px WoodEdge(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#c89a68"), C("#b58555"));
    p.HL(0,0,16, C("#e8b880"));
    p.HL(0,1,16, C("#d8a870"));
    p.R(0,13,16,1, C("#7d5735"));
    p.R(0,14,16,2, C("#63452a"));
    p.P(4,6,C("#a87a4c")); p.P(11,9,C("#a87a4c"));
    return p;
  }
  public static Px WoodDark(){
    Px p=new Px(16,16);
    p.Fill(C("#5e4530"));
    p.Speck(0,0,16,16, C("#523c28"), 10, 188);
    p.HL(0,0,16, C("#6e5238"));
    return p;
  }
  public static void LeafSpecks(Px p,int x,int y,int w,int h,int n,int seed){
    Color[] cols={ C("#e8a23c"), C("#d8703a"), C("#c9552e"), C("#f0b04a") };
    int s=seed;
    for(int k=0;k<n;k++){
      s=s*1103515245+12345; int rx=((s>>16)&0x7fff)%w;
      s=s*1103515245+12345; int ry=((s>>16)&0x7fff)%h;
      s=s*1103515245+12345; int ci=((s>>16)&0x7fff)%cols.Length;
      p.P(x+rx,y+ry,cols[ci]);
    }
  }
  public static Px PathA(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#b08a58"), C("#a07c4c"));
    p.Speck(0,0,16,16, C("#987648"), 8, 199);
    p.Speck(0,0,16,16, C("#c09a64"), 6, 211);
    LeafSpecks(p,0,0,16,16,7,222);
    p.HL(0,15,16, C("#8a6a40"));
    return p;
  }
  public static Px PathB(){
    Px p=PathA();
    LeafSpecks(p,0,0,16,16,10,233);
    p.P(4,4,C("#8a6a40")); p.P(12,10,C("#8a6a40"));
    return p;
  }
  public static Px PathEdge(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#bb9360"), C("#a8824f"));
    p.HL(0,0,16, C("#d4aa74"));
    p.R(0,14,16,2, C("#7d5f3a"));
    LeafSpecks(p,0,2,16,12,6,244);
    return p;
  }
  public static Px GrassA(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#a3a35e"), C("#8f8f50"));
    p.Speck(0,0,16,16, C("#b5b56e"), 10, 255);
    p.Speck(0,0,16,16, C("#7c7c44"), 8, 266);
    LeafSpecks(p,0,0,16,16,5,277);
    return p;
  }
  public static Px WallPaper(){
    Px p=new Px(16,16);
    p.Grad(0,0,16,16, C("#ecdcbd"), C("#dfcfae"));
    p.P(3,3,C("#d8c8a2")); p.P(9,6,C("#d8c8a2")); p.P(5,11,C("#d8c8a2"));
    p.P(12,2,C("#d8c8a2")); p.P(13,9,C("#d8c8a2"));
    p.HL(0,0,16, C("#f2e6c8"));
    return p;
  }
  public static Px WallPaperB(){
    Px p=WallPaper();
    p.R(4,4,8,6, C("#e2d2ae"));                    // faint sun patch
    p.Speck(0,0,16,16, C("#d0bf9c"), 5, 288);
    return p;
  }
  public static Px RailWood(){
    Px p=new Px(16,16);
    p.R(0,2,16,4, C("#7d5a40"));
    p.HL(0,2,16, C("#936e4e"));
    p.HL(0,5,16, C("#63452a"));
    p.R(0,6,16,10, C("#c8a26e"));
    p.HL(0,6,16, C("#d8b47e"));
    p.Speck(0,7,16,9, C("#b8925e"), 8, 299);
    return p;
  }
  public static Px Wainscot(){
    Px p=new Px(16,16);
    p.Fill(C("#6a4a34"));
    p.HL(0,0,16, C("#7d5a40"));
    p.V(5,2,14, C("#5e4130")); p.V(11,3,13, C("#5e4130"));  // panel grooves
    p.Speck(0,0,16,16, C("#573c28"), 8, 311);
    p.HL(0,15,16, C("#452e1e"));
    return p;
  }
  public static Px BaseWood(){
    Px p=new Px(16,16);
    p.Fill(C("#573c28"));
    p.HL(0,0,16, C("#6a4a34"));
    p.R(0,4,16,12, C("#452e1e"));
    p.Speck(0,5,16,10, C("#3a2518"), 6, 322);
    return p;
  }
  public static Px WindowOld(){
    Px p=new Px(16,16);
    p.Fill(C("#5e4130"));
    p.R(2,2,12,12, C("#e8906a"));
    p.Grad(2,2,12,5, C("#ffbf80"), C("#f2a26a"));
    p.R(2,7,12,3, C("#e8906a"));
    p.R(2,10,12,4, C("#d8784e"));
    // maple leaf silhouette on glass
    p.P(9,6,C("#8a4a2a")); p.P(10,7,C("#8a4a2a")); p.P(8,7,C("#8a4a2a"));
    p.V(7,2,12, C("#6e4d38")); p.HL(2,7,12, C("#6e4d38"));
    p.R(1,1,14,1, C("#7d5a40")); p.R(1,14,14,1, C("#452e1e"));
    return p;
  }
  public static Px SillOld(){
    Px p=new Px(16,16);
    p.Fill(C("#dfcfae"));
    p.R(0,5,16,4, C("#936e4e"));
    p.HL(0,5,16, C("#a87e58"));
    p.HL(0,8,16, C("#6e4d38"));
    p.R(0,9,16,2, C("#c8b48c"));
    p.R(0,11,16,5, C("#d0bf9c"));
    p.Speck(0,11,16,5, C("#c0af88"), 6, 333);
    return p;
  }
  public static Px DoorHome(bool top){
    Px p=new Px(16,16);
    if(top){
      p.Fill(C("#6a4a34"));
      p.R(1,0,14,16, C("#7d5a40"));
      p.R(3,2,10,6, C("#4e3a28"));
      p.R(3,2,10,1, C("#5e4832"));
      p.P(6,4,C("#e8a23c")); p.P(9,3,C("#e8a23c"));   // light through glass
      p.V(7,2,6, C("#3e2e20"));
      p.R(1,0,14,1, C("#936e4e"));
    } else {
      p.Fill(C("#6a4a34"));
      p.R(1,0,14,13, C("#7d5a40"));
      p.R(3,2,10,5, C("#4e3a28"));
      p.R(11,7,2,3, C("#c8a26e"));                    // handle
      // warm light seam at floor gap
      p.R(1,12,14,1, C("#ffbf80"));
      p.R(1,13,14,2, C("#ffd9a0"));
      p.R(0,13,16,3, C("#452e1e"));
      p.Dith(1,13,14,2, C("#ffd9a0"), C("#ffbf80"));
    }
    return p;
  }
  public static Px Engawa(){
    Px p=new Px(16,16);
    p.R(0,0,16,4, C("#cf9f6e"));
    p.HL(0,0,16, C("#e8b880"));
    p.R(0,4,16,8, C("#b08151"));
    p.HL(0,4,16, C("#c09263"));
    p.V(7,4,8, C("#8a6238"));
    p.R(0,12,16,4, C("#7d5735"));
    p.HL(0,12,16, C("#8a6238"));
    return p;
  }
  public static Px Rocker(){
    Px p=new Px(16,16);
    Color w=C("#8a6238"), wHi=C("#a87e50"), wDk=C("#63452a");
    p.R(3,1,8,2, wHi); p.HL(3,1,8,w);                // top rail
    p.V(3,3,5,w); p.V(10,3,5,w);                     // back posts
    p.HL(3,5,8,w); p.HL(3,7,8,w);                    // slats
    p.R(4,8,8,2, wHi);                               // seat
    p.V(4,10,3,wDk); p.V(11,10,3,wDk);               // front legs
    p.HL(2,13,12,w);                                 // rocker runner
    p.P(1,14,wDk); p.P(14,14,wDk);                   // runner tips
    p.V(5,3,5,C("#5e4130")); p.V(8,3,5,C("#5e4130"));
    p.HL(2,15,12, Color.FromArgb(80,40,24,10));
    return p;
  }
  public static Px TvOld(){
    Px p=new Px(16,16);
    p.R(2,1,12,9, C("#736a5e"));
    p.R(2,1,12,1, C("#8a8175"));
    p.R(3,2,8,7, C("#1e2833"));
    p.R(3,2,8,1, C("#2e3c4a"));
    p.R(4,3,4,3, C("#3a5a6e"));                       // screen glow
    p.P(5,4,C("#6e94a8")); p.P(7,5,C("#527a8e"));
    p.R(12,2,1,7, C("#575046"));
    p.P(12,6,C("#c0392b"));                            // power led
    p.R(3,10,10,2, C("#575046"));
    p.R(4,12,8,2, C("#8a8175"));                       // stand
    p.R(2,14,12,1, C("#575046"));
    p.HL(2,15,12, Color.FromArgb(80,40,24,10));
    return p;
  }
  public static Px GrandClock(bool top){
    Px p=new Px(16,16);
    Color w=C("#6a4a34"), wHi=C("#7d5a40"), wDk=C("#452e1e");
    if(top){
      p.R(3,0,10,3, wHi); p.HL(3,0,10,w);              // crown
      p.R(4,3,8,9, w);
      p.R(5,4,6,6, C("#e8dfc9"));                      // clock face
      p.P(7,6,wDk); p.P(8,6,wDk); p.P(8,7,wDk);
      p.P(5,4,C("#8a867c")); p.P(10,4,C("#8a867c"));
      p.V(4,3,1,wHi); p.V(11,3,1,wHi);
    } else {
      p.R(4,0,8,12, w);
      p.V(4,0,12,wHi); p.V(11,0,12,wDk);
      p.R(5,1,6,9, C("#2e2018"));                      // pendulum case
      p.V(7,2,4, C("#c8a26e"));                        // pendulum rod
      p.R(6,6,3,2, C("#f0d060"));                      // brass bob
      p.P(7,6,C("#fff4c0"));
      p.R(4,12,8,3, wDk);
      p.HL(4,12,8, wHi);
      p.HL(2,15,12, Color.FromArgb(80,40,24,10));
    }
    return p;
  }
  public static Px Cabinet(bool top){
    Px p=new Px(16,16);
    Color w=C("#7d5a40"), wHi=C("#936e4e"), wDk=C("#573c28");
    if(top){
      p.R(1,0,14,2, wHi); p.HL(1,0,14,w);
      p.R(1,2,14,14, w);
      p.R(2,5,5,4, C("#e8dfc9")); p.P(3,6,C("#c8a26e")); p.P(4,6,C("#8a6238")); // photo frame
      p.R(9,5,4,4, C("#4e6c88")); p.HL(9,5,4,C("#5e7c98"));                     // book row
      p.R(2,11,12,2, wDk);
    } else {
      p.R(1,0,14,14, w);
      p.V(1,0,14,wHi); p.V(14,0,14,wDk);
      p.R(2,2,11,1, wDk);                          // drawer seams
      p.R(2,7,11,1, wDk);
      p.R(6,4,3,1, C("#c8a26e")); p.R(6,9,3,1, C("#c8a26e")); // handles
      p.R(1,13,14,3, wDk);
      p.HL(1,13,14, wHi);
      p.HL(1,15,14, Color.FromArgb(80,40,24,10));
    }
    return p;
  }
  public static Px Bench(){
    Px p=new Px(16,16);
    Color w=C("#a87e50"), wHi=C("#c09263"), wDk=C("#7d5735");
    Color iron=C("#4a4a52"), ironHi=C("#5e5e66");
    p.HL(2,4,12,wHi); p.HL(2,5,12,w);               // back slat
    p.HL(2,7,12,wHi); p.HL(2,8,12,w);
    p.R(3,9,10,2, wHi); p.HL(3,9,10,w);             // seat
    p.HL(3,10,10,wDk);
    p.V(3,11,4,iron); p.V(12,11,4,iron);
    p.P(3,11,ironHi); p.P(12,11,ironHi);
    p.HL(2,15,12, Color.FromArgb(80,40,24,10));
    return p;
  }
  public static Px TrunkMaple(){
    Px p=new Px(16,16);
    // canopy lower edge fills top 2/3
    p.R(1,0,14,8, C("#d07838"));
    p.R(2,0,6,3, C("#e09048"));
    p.R(9,1,5,2, C("#f0b060"));
    p.Speck(1,0,14,8, C("#c06030"), 10, 344);
    p.Speck(1,0,14,8, C("#e8a23c"), 8, 355);
    p.HL(1,8,14, C("#a8481e"));
    // trunk
    p.R(6,8,4,8, C("#6a4a34"));
    p.V(6,8,8, C("#7d5a40")); p.V(9,8,8, C("#573c28"));
    p.V(5,10,2, C("#6a4a34")); p.V(10,11,3, C("#6a4a34")); // root flare
    p.P(7,12,C("#573c28"));
    return p;
  }
  public static Px LeavesPile(){
    Px p=new Px(16,16);
    p.R(2,9,12,5, C("#c9552e"));
    p.Dith(3,8,10,2, C("#e8a23c"), C("#d8703a"));
    p.R(2,13,12,2, C("#a8441e"));
    p.Speck(2,9,12,5, C("#f0b04a"), 8, 366);
    p.Speck(2,9,12,5, C("#b84a24"), 6, 377);
    p.P(4,7,C("#e8a23c")); p.P(11,8,C("#d8703a"));
    p.HL(2,15,12, Color.FromArgb(80,40,24,10));
    return p;
  }
  public static Px LeavesScatter(){
    Px p=new Px(16,16);
    LeafSpecks(p,0,0,16,16,10,388);
    p.P(3,5,C("#a8441e")); p.P(12,11,C("#a8441e"));
    return p;
  }
  public static Px LanternStone(){
    Px p=new Px(16,16);
    Color g=C("#9aa0a4"), gHi=C("#b8bec2"), gDk=C("#767c82");
    p.R(5,1,6,3, gHi); p.HL(5,1,6,g);               // cap
    p.P(4,2,g); p.P(11,2,g);
    p.R(6,4,4,4, g);
    p.R(7,5,2,2, C("#3a3e42"));                      // light window
    p.P(7,5,C("#f0d060"));
    p.R(5,8,6,2, gDk);
    p.R(6,10,4,4, g);
    p.V(6,10,4,gHi); p.V(9,10,4,gDk);
    p.R(4,14,8,2, gDk);
    p.HL(4,15,8, Color.FromArgb(80,40,24,10));
    return p;
  }
  public static Px FenceWood(){
    Px p=new Px(16,16);
    p.HL(0,4,16, C("#a87e50")); p.HL(0,5,16, C("#8a6238"));
    p.R(2,0,3,16, C("#936e4e"));
    p.V(2,0,16,C("#a87e50")); p.V(4,0,16,C("#7d5a40"));
    p.R(10,0,3,16, C("#936e4e"));
    p.V(10,0,16,C("#a87e50")); p.V(12,0,16,C("#7d5a40"));
    p.HL(0,10,16, C("#a87e50")); p.HL(0,11,16, C("#8a6238"));
    LeafSpecks(p,0,0,16,4,3,399);
    return p;
  }
  public static Px PhotoFrame(){
    Px p=new Px(16,16);
    p.R(3,3,10,10, C("#8a6238"));
    p.R(4,4,8,8, C("#e8dfc9"));
    p.R(5,7,6,3, C("#c8a26e"));                     // family silhouette band
    p.P(6,6,C("#8a6238")); p.P(9,6,C("#6a4a34"));
    p.R(7,12,2,2, C("#8a6238"));
    p.P(7,13,C("#5e4130")); p.P(8,13,C("#5e4130"));
    return p;
  }

  // ================= PARALLAX : STAGE 1 MORNING =================
  public static Px SkyMorning(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,90,  C("#a8cfE8".ToLower()), C("#cfe4f2"));
    p.Grad(0,90,320,50, C("#cfe4f2"), C("#ffe9c4"));
    p.Grad(0,140,320,40,C("#ffe9c4"), C("#ffd9a0"));
    // morning sun rising over the school roofline
    for(int y=0;y<180;y++) for(int x=0;x<320;x++){
      int dx=x-80, dy=y-82, d2=dx*dx+dy*dy;
      if(d2<=196) p.P(x,y,C("#fff6dc"));
      else if(d2<=256 && ((x+y)&1)==0) p.P(x,y,C("#fff0c8"));
      else if(d2<=340 && ((x+y)&1)==0) p.P(x,y,C("#ffe9c4"));
    }
    // horizontal cloud streaks
    p.R(30,40,90,2, C("#ffffff")); p.HL(28,41,94, Color.FromArgb(120,255,255,255));
    p.R(190,60,110,2, C("#ffffff")); p.HL(188,61,114, Color.FromArgb(110,255,255,255));
    p.R(120,26,70,2, Color.FromArgb(200,255,255,255));
    // birds
    p.P(210,44,C("#5a7080")); p.P(211,43,C("#5a7080")); p.P(212,44,C("#5a7080"));
    p.P(246,36,C("#5a7080")); p.P(247,35,C("#5a7080")); p.P(248,36,C("#5a7080"));
    return p;
  }
  public static Px FarSchool(){
    Px p=new Px(320,180);
    Color b=C("#9cb8cc"), bDk=C("#89a6bc"), win=C("#fff4c8");
    // main teaching block
    p.R(30,96,120,84,b);
    p.R(30,92,120,4,bDk);
    for(int r=0;r<3;r++) for(int col=0;col<7;col++)
      p.R(40+col*15,104+r*20,8,8, win);
    p.R(150,110,90,70,b);
    for(int r=0;r<2;r++) for(int col=0;col<4;col++)
      p.R(158+col*20,118+r*24,10,8, win);
    // gate posts
    p.R(250,120,10,60,bDk); p.R(280,120,10,60,bDk);
    // flagpole + flag
    p.R(300,60,2,120,bDk);
    p.R(302,62,16,8,C("#e05a4a")); p.R(302,62,16,2,C("#f07a5a"));
    // ground fog band
    for(int y=168;y<180;y++){
      Color fc=Lerp(C("#c8d8e2"), C("#ffd9a0"), (y-168)/12.0);
      p.R(0,y,320,1,fc);
    }
    return p;
  }
  public static Px MidTrees(){
    Px p=new Px(320,180);
    // tree line
    for(int i=0;i<7;i++){
      int cx=22+i*47, r=16+((i*13)%9);
      for(int y=0;y<r*2;y++) for(int x=-r;x<=r;x++){
        int d2=x*x+(y-r)*(y-r);
        if(d2<=r*r) p.P(cx+x,130-r+y, C(i%2==0?"#7ab86a":"#8fcc7e"));
      }
      p.R(cx-2,138,4,20, C("#6a9a5c"));
    }
    // track fence rails
    p.HL(0,150,320, C("#96a8b8")); p.HL(0,160,320, C("#96a8b8"));
    for(int x=0;x<320;x+=20) p.R(x,148,2,20, C("#8496a6"));
    // low hedge base
    p.R(0,166,320,14, C("#6a9a5c"));
    p.HL(0,166,320, C("#7ab86a"));
    p.Speck(0,167,320,13, C("#5a8a4e"), 40, 411);
    return p;
  }
  public static Px NearHedge(){
    Px p=new Px(320,180);
    p.R(0,140,320,40, C("#4e7a46"));
    for(int x=0;x<320;x+=8){
      int hh=6+((x*7)%5);
      for(int y=0;y<hh;y++) for(int w=-4;w<=4;w++){
        int d2=w*w+(y-hh)*(y-hh)/2;
        if(d2<=18) p.P(x+w,140-hh+y, C(((x+y)&1)==0?"#5e8a54":"#548050"));
      }
    }
    p.HL(0,140,320, C("#6a9a5e"));
    p.Speck(0,141,320,39, C("#3c6038"), 50, 422);
    p.Speck(0,141,320,39, C("#6a9a5e"), 30, 433);
    return p;
  }

  // ================= PARALLAX : STAGE 2 NIGHT =================
  public static Px SkyNight(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,70,  C("#101828"), C("#182236"));
    p.Grad(0,70,320,70, C("#182236"), C("#223150"));
    p.Grad(0,140,320,40,C("#223150"), C("#2e4062"));
    // storm cloud blobs
    for(int i=0;i<9;i++){
      int cx=18+i*36, cy=24+((i*17)%28), rx=30+((i*11)%16);
      for(int y=-10;y<=10;y++) for(int x=-rx;x<=rx;x++){
        int d2=x*x/4+y*y;
        if(d2<=rx) p.P(((cx+x)%320+320)%320, cy+y, C("#1c2840"));
      }
    }
    // faint moon glow
    for(int y=0;y<180;y++) for(int x=0;x<320;x++){
      int dx=x-256, dy=y-52, d2=dx*dx+dy*dy;
      if(d2<=120 && ((x+y)&1)==0) p.P(x,y,C("#2c3c58"));
    }
    return p;
  }
  public static Px FarSkyline(){
    Px p=new Px(320,180);
    Color b=C("#1a2438");
    int[] hs={70,95,60,110,80,65,100,88};
    int x=0;
    for(int i=0;i<8;i++){
      int w=34+((i*7)%14), h=hs[i];
      p.R(x,180-h,w,h,b);
      // spire
      if(i%3==0) p.R(x+w/2,180-h-10,2,10,b);
      // lit windows
      for(int wy=0;wy<h-12;wy+=10) for(int wx=4;wx<w-6;wx+=9){
        bool lit=(((i*31+wy*7+wx*13)/3)%4)==0;
        if(lit) p.P(x+wx,180-h+8+wy, (((i+wx+wy)&1)==0)?C("#ffd98a"):C("#9fd8ff"));
      }
      x+=w+((i*5)%10)+4;
    }
    p.R(0,176,320,4,C("#141c2e"));
    return p;
  }
  public static Px MidTowers(){
    Px p=new Px(320,180);
    Color b=C("#141c2e");
    // nearer towers with neon
    p.R(20,60,54,120,b);
    for(int wy=0;wy<100;wy+=14) for(int wx=6;wx<48;wx+=11)
      if(((wx*wy)%5)<2) p.R(20+wx,66+wy,4,5,C("#223048"));
    // neon sign pink
    p.R(30,76,34,12,C("#3a1e34"));
    p.R(32,78,30,8,C("#ff4f9a"));
    p.R(32,78,30,2,C("#ff8ab8"));
    p.Dith(30,88,34,4, C("#ff4f9a"), C("#3a1e34"));
    // tower 2 + cyan sign
    p.R(150,40,64,140,b);
    for(int wy=0;wy<120;wy+=14) for(int wx=6;wx<58;wx+=12)
      if(((wx+wy)%4)<2) p.R(150+wx,48+wy,4,5,C("#1e2c44"));
    p.R(162,56,40,10,C("#0e2a2e"));
    p.R(164,58,36,6,C("#3ee6d8"));
    p.R(164,58,36,2,C("#8af2e8"));
    p.Dith(162,66,40,4, C("#3ee6d8"), C("#0e2a2e"));
    // crane silhouette
    p.R(268,70,3,110,C("#101828"));
    p.R(252,72,60,3,C("#101828"));
    p.R(252,72,3,26,C("#101828"));
    p.R(252,96,10,2,C("#101828"));
    // amber neon low on right tower
    p.R(300,140,20,8,C("#33220e"));
    p.R(300,142,20,4,C("#ffb347"));
    // base band
    p.R(0,172,320,8,C("#101828"));
    return p;
  }
  public static Px NearMullions(){
    Px p=new Px(320,180);
    // dark interior glass columns only (rest stays transparent, no canvas tint)
    for(int x=0;x<320;x+=64){
      p.R(x,0,10,180, C("#0e1420"));
      p.R(x+1,0,2,180, C("#2e3c54"));
      p.R(x+8,0,2,180, C("#1a2434"));
    }
    // bottom rail
    p.R(0,172,320,8, C("#0a0f18"));
    p.HL(0,172,320, C("#1a2434"));
    return p;
  }
  public static Px RainOverlay(){
    Px p=new Px(320,180);
    int seed=500;
    for(int k=0;k<70;k++){
      seed=seed*1103515245+12345; int rx=((seed>>16)&0x7fff)%320;
      seed=seed*1103515245+12345; int ry=((seed>>16)&0x7fff)%180;
      int len=8+((seed>>10)&7);
      WrapDiag(p, rx, ry, len, C("#5c7898"), 3);
    }
    for(int k=0;k<40;k++){
      seed=seed*1103515245+12345; int rx=((seed>>16)&0x7fff)%320;
      seed=seed*1103515245+12345; int ry=((seed>>16)&0x7fff)%180;
      int len=12+((seed>>10)&9);
      WrapDiag(p, rx, ry, len, C("#7c9ab8"), 3);
    }
    return p;
  }

  // ================= PARALLAX : STAGE 3 SUNSET =================
  public static Px SkySunset(){
    Px p=new Px(320,180);
    p.Grad(0,0,320,60,  C("#7a6a9c"), C("#a87a94"));
    p.Grad(0,60,320,50, C("#a87a94"), C("#e8906a"));
    p.Grad(0,110,320,50,C("#e8906a"), C("#ffbf80"));
    p.Grad(0,160,320,20,C("#ffbf80"), C("#ffd9a0"));
    // big low sun
    for(int y=0;y<180;y++) for(int x=0;x<320;x++){
      int dx=x-160, dy=y-120, d2=dx*dx+dy*dy;
      if(d2<=900) p.P(x,y,C("#fff2d0"));
      else if(d2<=1100 && ((x+y)&1)==0) p.P(x,y,C("#ffe2a8"));
      else if(d2<=1500 && ((x+y)&1)==0) p.P(x,y,C("#ffc98e"));
    }
    // cloud bands lit from below, dithered ends
    p.R(24,44,92,4,C("#b07a8e")); p.R(24,47,92,3,C("#e8906a"));
    p.Dith(20,44,4,6,C("#b07a8e"),C("#c48488")); p.Dith(116,44,4,6,C("#b07a8e"),C("#c48488"));
    p.Dith(24,47,4,3,C("#e8906a"),C("#ffb37e")); p.Dith(116,47,4,3,C("#e8906a"),C("#ffb37e"));
    p.R(214,30,82,4,C("#a06e88")); p.R(214,33,82,3,C("#d88a6a"));
    p.Dith(210,30,4,6,C("#a06e88"),C("#c48488")); p.Dith(296,30,4,6,C("#a06e88"),C("#c48488"));
    p.Dith(214,33,4,3,C("#d88a6a"),C("#ffb37e")); p.Dith(296,33,4,3,C("#d88a6a"),C("#ffb37e"));
    p.R(94,72,122,3,C("#c48488")); p.R(94,74,122,2,C("#ffb37e"));
    p.Dith(90,72,4,5,C("#c48488"),C("#d89a94")); p.Dith(216,72,4,5,C("#c48488"),C("#d89a94"));
    // birds
    p.P(60,58,C("#4a3a58")); p.P(61,57,C("#4a3a58")); p.P(62,58,C("#4a3a58"));
    return p;
  }
  public static Px FarTown(){
    Px p=new Px(320,180);
    Color hill=C("#a08098"), roof=C("#8a6a84"), roofDk=C("#755870");
    // hills
    for(int x=0;x<320;x++){
      int h=26+((int)(Math.Sin(x/34.0)*8))+((x*7)%5);
      p.R(x,180-h,1,h,hill);
    }
    // town roofs strip
    int rx=14;
    for(int i=0;i<9;i++){
      int w=26+((i*9)%12), h=16+((i*5)%8);
      p.R(rx,180-h,w,h,roof);
      p.R(rx+4,180-h-6,w/2,6,roofDk);           // chimney/roof ridge
      p.P(rx+6,180-h+4,C("#ffd98a"));           // one lit window
      rx+=w+10;
    }
    for(int y=176;y<180;y++)
      p.R(0,y,320,1,Lerp(C("#9a7a90"), C("#ffbf80"), (y-176)/4.0));
    return p;
  }
  public static Px MidMaples(){
    Px p=new Px(320,180);
    // maple canopies
    for(int i=0;i<6;i++){
      int cx=30+i*56, r=17+((i*11)%8);
      string base_= i%3==0? "#e09048" : (i%3==1? "#d07838" : "#c05828");
      for(int y=-r;y<=r;y++) for(int x=-r;x<=r;x++){
        int d2=x*x+y*y;
        if(d2<=r*r) p.P(cx+x,128-r+y, C(base_));
      }
      // rim light on top-left
      for(int y=-r;y<=0;y++) for(int x=-r;x<=0;x++){
        int d2=x*x+y*y;
        if(d2<=r*r && d2>=r*r-14 && ((x+y)&1)==0) p.P(cx+x,128-r+y, C("#f0b060"));
      }
      p.R(cx-2,138,4,26, C("#6a4a34"));
      p.V(cx-2,138,26, C("#7d5a40")); p.V(cx+1,138,26, C("#573c28"));
    }
    // park lamp
    p.R(296,110,4,6,C("#3a3e42"));
    p.R(293,102,10,8,C("#4a4e52"));
    p.R(295,104,6,4,C("#ffd98a"));
    p.R(296,116,3,48,C("#3a3e42"));
    p.R(293,160,8,3,C("#3a3e42"));
    // ground band
    p.R(0,164,320,16, C("#7d5a40"));
    p.HL(0,164,320, C("#936e4e"));
    return p;
  }
  public static Px NearFence(){
    Px p=new Px(320,180);
    // wooden fence (lowered so gameplay ground reads clearly)
    p.R(0,142,320,38, C("#7d5a40"));
    for(int x=0;x<320;x+=22){
      p.R(x,136,12,44, C("#8a6238"));
      p.R(x,136,12,2, C("#a87e50"));
      p.V(x,136,44, C("#936e4e")); p.V(x+11,136,44, C("#6e4d38"));
    }
    p.HL(0,152,320, C("#5e4130"));
    p.HL(0,163,320, C("#5e4130"));
    // shrubs in front of fence, poking over the top
    for(int x=0;x<320;x+=10){
      int hh=8+((x*13)%7);
      for(int y=0;y<hh;y++) for(int w=-5;w<=5;w++){
        int d2=w*w+(y-hh)*(y-hh)/2;
        if(d2<=26) p.P(x+w,142-hh+y, C(((x*3+y)&1)==0?"#6a7038":"#5e6430"));
      }
    }
    // grass silhouettes at base
    for(int x=0;x<320;x+=6){
      int hh=4+((x*3)%5);
      p.R(x,180-hh,1,hh,C("#5e6038"));
      p.P(x+1,180-hh+2,C("#6e7040"));
    }
    return p;
  }

  // ---------- io ----------
  public static void SavePx(Px p, string path){
    using(Bitmap b=new Bitmap(p.W,p.H,PixelFormat.Format32bppArgb)){
      for(int y=0;y<p.H;y++) for(int x=0;x<p.W;x++) b.SetPixel(x,y,p.c[x,y]);
      b.Save(path, ImageFormat.Png);
    }
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
  public class Frame { public string name; public Px px; public string role; public bool solid; public string note; }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ================= L2 SHEET =================
$t2 = New-Object System.Collections.Generic.List[object]
function Add-T2([string]$name, $px, [string]$role, [bool]$solid, [string]$note){
  $f = New-Object Gen2+Frame
  $f.name=$name; $f.px=$px; $f.role=$role; $f.solid=$solid; $f.note=$note
  $t2.Add($f)
}
Add-T2 "carpet_a"      ([Gen2]::CarpetA())      "ground" $true  "office carpet, tiling"
Add-T2 "carpet_b"      ([Gen2]::CarpetB())      "ground" $true  "carpet worn variant"
Add-T2 "carpet_edge"   ([Gen2]::CarpetEdge())   "ground" $true  "carpet platform top edge"
Add-T2 "carpet_dark"   ([Gen2]::CarpetDark())   "ground" $true  "carpet under-layer"
Add-T2 "wetfloor_a"    ([Gen2]::WetFloor(71))   "ground" $true  "reflective floor near windows (streak A)"
Add-T2 "wetfloor_b"    ([Gen2]::WetFloor(97))   "ground" $true  "reflective floor variant B"
Add-T2 "wall_office"   ([Gen2]::WallOffice())   "decor"  $false "drywall panel w/ seam"
Add-T2 "wall_office_b" ([Gen2]::WallOfficeB())  "decor"  $false "drywall scuffed variant"
Add-T2 "ceiling_plain" ([Gen2]::CeilingPlain()) "decor"  $false "ceiling T-bar tile"
Add-T2 "ceiling_light" ([Gen2]::CeilingLight()) "decor"  $false "fluorescent panel (bright)"
Add-T2 "partition_top" ([Gen2]::PartitionTop()) "platform" $true "cubicle partition top cap"
Add-T2 "partition_body"([Gen2]::PartitionBody())"platform" $true "cubicle fabric body"
Add-T2 "desk_l"        ([Gen2]::Desk(1))        "platform" $true "office desk row left cap"
Add-T2 "desk_m"        ([Gen2]::Desk(0))        "platform" $true "office desk row middle"
Add-T2 "desk_r"        ([Gen2]::Desk(2))        "platform" $true "office desk row right cap"
Add-T2 "desk_monitor"  ([Gen2]::Desk(3))        "platform" $true "desk with glowing CRT"
Add-T2 "desk_single"   ([Gen2]::Desk(4))        "platform" $true "single desk w/ papers+mug"
$pr = [Gen2]::Split2x2([Gen2]::PrinterBig(), "printer")
Add-T2 "printer_tl" $pr["printer_tl"] "platform" $true "big copier 2x2 top-left"
Add-T2 "printer_tr" $pr["printer_tr"] "platform" $true "big copier 2x2 top-right"
Add-T2 "printer_bl" $pr["printer_bl"] "platform" $true "big copier 2x2 bottom-left"
Add-T2 "printer_br" $pr["printer_br"] "platform" $true "big copier 2x2 bottom-right"
Add-T2 "vending_top"   ([Gen2]::Vending($true))  "platform" $true "vending machine upper (stack on vending_bottom)"
Add-T2 "vending_bottom"([Gen2]::Vending($false)) "platform" $true "vending machine lower"
Add-T2 "blinds_closed" ([Gen2]::Blinds($true))   "decor" $false "venetian blinds closed"
Add-T2 "blinds_open"   ([Gen2]::Blinds($false))  "decor" $false "blinds raised, night city dots"
Add-T2 "glasswall_a"   ([Gen2]::GlassWall(31))   "decor" $false "floor-to-ceiling night glass A"
Add-T2 "glasswall_b"   ([Gen2]::GlassWall(57))   "decor" $false "night glass variant B"
Add-T2 "mullion"       ([Gen2]::Mullion())       "decor" $false "glass wall vertical column"
Add-T2 "elevator"      ([Gen2]::Elevator())      "decor" $false "elevator doors w/ call panel"
Add-T2 "paper_pile"    ([Gen2]::PaperPile())     "decor" $false "paper stacks w/ red marks"
Add-T2 "chair_office"  ([Gen2]::ChairOffice())   "decor" $false "swivel chair"
Add-T2 "bin_office"    ([Gen2]::BinOffice())     "decor" $false "mesh bin w/ overflow"
Add-T2 "box_kpi"       ([Gen2]::BoxKpi())        "decor" $false "KPI cardboard box"
Add-T2 "cable_floor"   ([Gen2]::CableFloor())    "decor" $false "cable bundle on floor"

$sheet2 = New-Object Gen2+Px 256,256
$j2 = New-Object System.Collections.Generic.List[string]
for($i=0; $i -lt $t2.Count; $i++){
  $t=$t2[$i]; $x=($i%16)*16; $y=[math]::Floor($i/16)*16
  [Gen2]::Blit($sheet2, $t.px, $x, $y)
  $j = '{{"filename":"{0}","frame":{{"x":{1},"y":{2},"w":16,"h":16}},"rotated":false,"trimmed":false,"spriteSourceSize":{{"x":0,"y":0,"w":16,"h":16}},"sourceSize":{{"w":16,"h":16}},"meta":{{"role":"{3}","solid":{4},"note":"{5}"}}}}' -f $t.name,$x,$y,$t.role,($t.solid.ToString().ToLower()),$t.note
  $j2.Add($j)
}
[Gen2]::SavePx($sheet2, (Join-Path $tset "office_rain.png"))
$json2 = '{"frames":[' + ($j2 -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"office_rain.png","format":"RGBA8888","size":{"w":256,"h":256},"scale":"1","tileSize":16,"version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $tset "office_rain.json"), $json2, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("office_rain OK tiles=" + $t2.Count)

# ================= L3 SHEET =================
$t3 = New-Object System.Collections.Generic.List[object]
function Add-T3([string]$name, $px, [string]$role, [bool]$solid, [string]$note){
  $f = New-Object Gen2+Frame
  $f.name=$name; $f.px=$px; $f.role=$role; $f.solid=$solid; $f.note=$note
  $t3.Add($f)
}
Add-T3 "wood_a"        ([Gen2]::WoodA())      "ground" $true  "home plank floor, tiling"
Add-T3 "wood_b"        ([Gen2]::WoodB())      "ground" $true  "plank variant"
Add-T3 "wood_edge"     ([Gen2]::WoodEdge())   "ground" $true  "plank top edge"
Add-T3 "wood_dark"     ([Gen2]::WoodDark())   "ground" $true  "plank under-layer"
Add-T3 "path_a"        ([Gen2]::PathA())      "ground" $true  "autumn garden path"
Add-T3 "path_b"        ([Gen2]::PathB())      "ground" $true  "path variant, more leaves"
Add-T3 "path_edge"     ([Gen2]::PathEdge())   "ground" $true  "path top edge"
Add-T3 "grass_a"       ([Gen2]::GrassA())     "ground" $true  "faded autumn grass"
Add-T3 "wall_paper"    ([Gen2]::WallPaper())  "decor"  $false "warm wallpaper"
Add-T3 "wall_paper_b"  ([Gen2]::WallPaperB()) "decor"  $false "wallpaper sun patch"
Add-T3 "rail_wood"     ([Gen2]::RailWood())   "decor"  $false "wall rail between paper and wainscot"
Add-T3 "wainscot"      ([Gen2]::Wainscot())   "decor"  $false "dark wood lower wall"
Add-T3 "base_wood"     ([Gen2]::BaseWood())   "decor"  $false "baseboard"
Add-T3 "window_old"    ([Gen2]::WindowOld())  "decor"  $false "old window, dusk glass + leaf"
Add-T3 "sill_old"      ([Gen2]::SillOld())    "decor"  $false "wooden sill"
Add-T3 "door_home_top" ([Gen2]::DoorHome($true))  "decor" $false "entry door upper"
Add-T3 "door_home_bot" ([Gen2]::DoorHome($false)) "decor" $false "entry door lower, warm light seam"
Add-T3 "engawa"        ([Gen2]::Engawa())     "platform" $true "veranda plank edge (decor-level platform)"
Add-T3 "rocker"        ([Gen2]::Rocker())     "decor"  $false "rocking chair"
Add-T3 "tv_old"        ([Gen2]::TvOld())      "decor"  $false "CRT tv w/ glow"
Add-T3 "clock_top"     ([Gen2]::GrandClock($true))  "decor" $false "grandfather clock upper (stack on clock_base)"
Add-T3 "clock_base"    ([Gen2]::GrandClock($false)) "decor" $false "grandfather clock lower w/ pendulum"
Add-T3 "cabinet_top"   ([Gen2]::Cabinet($true))  "decor" $false "old cabinet upper w/ photo"
Add-T3 "cabinet_bot"   ([Gen2]::Cabinet($false)) "decor" $false "old cabinet drawers"
Add-T3 "bench_park"    ([Gen2]::Bench())      "decor"  $false "park bench (decor only: elder cannot jump)"
Add-T3 "trunk_maple"   ([Gen2]::TrunkMaple()) "decor"  $false "maple trunk w/ canopy bottom"
Add-T3 "leaves_pile"   ([Gen2]::LeavesPile()) "decor"  $false "raked leaf pile"
Add-T3 "leaves_flat"   ([Gen2]::LeavesScatter()) "decor" $false "scattered leaves"
Add-T3 "lantern_stone" ([Gen2]::LanternStone()) "decor" $false "stone garden lantern"
Add-T3 "fence_wood"    ([Gen2]::FenceWood())  "decor"  $false "garden fence row, tiling"
Add-T3 "photo_frame"   ([Gen2]::PhotoFrame()) "decor"  $false "wall family photo"

$sheet3 = New-Object Gen2+Px 256,256
$j3 = New-Object System.Collections.Generic.List[string]
for($i=0; $i -lt $t3.Count; $i++){
  $t=$t3[$i]; $x=($i%16)*16; $y=[math]::Floor($i/16)*16
  [Gen2]::Blit($sheet3, $t.px, $x, $y)
  $j = '{{"filename":"{0}","frame":{{"x":{1},"y":{2},"w":16,"h":16}},"rotated":false,"trimmed":false,"spriteSourceSize":{{"x":0,"y":0,"w":16,"h":16}},"sourceSize":{{"w":16,"h":16}},"meta":{{"role":"{3}","solid":{4},"note":"{5}"}}}}' -f $t.name,$x,$y,$t.role,($t.solid.ToString().ToLower()),$t.note
  $j3.Add($j)
}
[Gen2]::SavePx($sheet3, (Join-Path $tset "home_autumn.png"))
$json3 = '{"frames":[' + ($j3 -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"home_autumn.png","format":"RGBA8888","size":{"w":256,"h":256},"scale":"1","tileSize":16,"version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $tset "home_autumn.json"), $json3, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("home_autumn OK tiles=" + $t3.Count)

# ================= PARALLAX =================
$layers = @(
  @{n="stage1_morning_sky";  p=[Gen2]::SkyMorning()},
  @{n="stage1_morning_far";  p=[Gen2]::FarSchool()},
  @{n="stage1_morning_mid";  p=[Gen2]::MidTrees()},
  @{n="stage1_morning_near"; p=[Gen2]::NearHedge()},
  @{n="stage2_night_sky";    p=[Gen2]::SkyNight()},
  @{n="stage2_night_far";    p=[Gen2]::FarSkyline()},
  @{n="stage2_night_mid";    p=[Gen2]::MidTowers()},
  @{n="stage2_night_near";   p=[Gen2]::NearMullions()},
  @{n="stage2_rain_overlay"; p=[Gen2]::RainOverlay()},
  @{n="stage3_sunset_sky";   p=[Gen2]::SkySunset()},
  @{n="stage3_sunset_far";   p=[Gen2]::FarTown()},
  @{n="stage3_sunset_mid";   p=[Gen2]::MidMaples()},
  @{n="stage3_sunset_near";  p=[Gen2]::NearFence()}
)
$mani = New-Object System.Collections.Generic.List[string]
foreach($L in $layers){
  [Gen2]::SavePx($L.p, (Join-Path $psx ($L.n + ".png")))
}
$m1 = '{"file":"stage1_morning_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}'
$m2 = '{"file":"stage1_morning_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}'
$m3 = '{"file":"stage1_morning_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}'
$m4 = '{"file":"stage1_morning_near.png","layer":"near","scrollFactor":0.85,"note":"repeat-x tileSprite"}'
$m5 = '{"file":"stage2_night_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}'
$m6 = '{"file":"stage2_night_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}'
$m7 = '{"file":"stage2_night_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}'
$m8 = '{"file":"stage2_night_near.png","layer":"near","scrollFactor":0.85,"note":"window mullions, repeat-x"}'
$m9 = '{"file":"stage2_rain_overlay.png","layer":"fx","scrollFactor":1.00,"note":"alpha streaks; scroll fast or animate offset for rain"}'
$m10= '{"file":"stage3_sunset_sky.png","layer":"sky","scrollFactor":0.10,"note":"repeat-x tileSprite"}'
$m11= '{"file":"stage3_sunset_far.png","layer":"far","scrollFactor":0.30,"note":"repeat-x tileSprite"}'
$m12= '{"file":"stage3_sunset_mid.png","layer":"mid","scrollFactor":0.60,"note":"repeat-x tileSprite"}'
$m13= '{"file":"stage3_sunset_near.png","layer":"near","scrollFactor":0.85,"note":"repeat-x tileSprite"}'
$mani.Add($m1);$mani.Add($m2);$mani.Add($m3);$mani.Add($m4)
$mani.Add($m5);$mani.Add($m6);$mani.Add($m7);$mani.Add($m8);$mani.Add($m9)
$mani.Add($m10);$mani.Add($m11);$mani.Add($m12);$mani.Add($m13)
$maniJson = '{"layers":[' + ($mani -join ",") + '],"meta":{"app":"FORGET-ME-NOT parallax by member-B","size":{"w":320,"h":180},"repeatX":true,"version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $psx "parallax.json"), $maniJson, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "parallax OK layers=13"

# ================= COMPOSITE MOCKUPS =================
function Compose([int]$idx){
  $c = New-Object Gen2+Px 320,180
  [Gen2]::Blit($c, $layers[$idx+0].p, 0, 0)
  [Gen2]::Blit($c, $layers[$idx+1].p, 0, 0)
  [Gen2]::Blit($c, $layers[$idx+2].p, 0, 0)
  [Gen2]::Blit($c, $layers[$idx+3].p, 0, 0)
  if($idx -eq 4){ [Gen2]::Blit($c, $layers[8].p, 0, 0) }
  return $c
}
$c1 = Compose 0
$c2 = Compose 4
$c3 = Compose 9
[Gen2]::SavePx([Gen2]::Scale($c1,3), (Join-Path $psx "preview\mockup_stage1_morning_x3.png"))
[Gen2]::SavePx([Gen2]::Scale($c2,3), (Join-Path $psx "preview\mockup_stage2_night_x3.png"))
[Gen2]::SavePx([Gen2]::Scale($c3,3), (Join-Path $psx "preview\mockup_stage3_sunset_x3.png"))
[Gen2]::SavePx($c1, (Join-Path $psx "preview\mockup_stage1_morning.png"))
[Gen2]::SavePx($c2, (Join-Path $psx "preview\mockup_stage2_night.png"))
[Gen2]::SavePx($c3, (Join-Path $psx "preview\mockup_stage3_sunset.png"))
Write-Host "mockups OK"
Write-Host "ALL DONE"
