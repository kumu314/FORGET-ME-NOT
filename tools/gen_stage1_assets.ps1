# ============================================================
# FORGET-ME-NOT - Member B asset generator (Stage 1)
# Generates: game/public/assets/tilesets/school_corridor.png (+ .json)
#            game/public/assets/tilesets/easter_eggs.png     (+ .json)
#            game/public/assets/tilesets/preview/*.png       (scene mockups, PR evidence)
# Pure ASCII on purpose (PS 5.1 parses BOM-less files as ANSI).
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # repo root
$out  = Join-Path $root "game\public\assets\tilesets"
$prev = Join-Path $out "preview"
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path $prev | Out-Null

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.IO;
using System.Text;

public static class Gen {
  // ---------- palette ----------
  public static readonly Color FloorHi   = From("#f0c090");
  public static readonly Color FloorBase = From("#e8a873");
  public static readonly Color FloorMid  = From("#cf8556");
  public static readonly Color FloorDark = From("#a05f38");
  public static readonly Color FloorGrout= From("#7d4a2d");
  public static readonly Color FloorDeep = From("#6b3d27");
  public static readonly Color FloorSpec = From("#f8d0a0");

  public static readonly Color WallBase  = From("#f2e4c0");
  public static readonly Color WallLight = From("#faf0d8");
  public static readonly Color WallStain = From("#e0d0a8");
  public static readonly Color WallStain2= From("#d8c49a");

  public static readonly Color GreenBase = From("#3d7a5c");
  public static readonly Color GreenLight= From("#5c9c78");
  public static readonly Color GreenDark = From("#2c5a42");
  public static readonly Color GreenDeep = From("#1f4230");

  public static readonly Color WoodHi    = From("#c98f55");
  public static readonly Color WoodBase  = From("#a87848");
  public static readonly Color WoodMid   = From("#8a5528");
  public static readonly Color WoodDark  = From("#6b4526");
  public static readonly Color WoodDeep  = From("#5e3818");

  public static readonly Color BoardBase = From("#1f4434");
  public static readonly Color BoardLit  = From("#2a5a44");
  public static readonly Color Chalk     = From("#f2ecd8");
  public static readonly Color ChalkDim  = From("#d8d0b8");
  public static readonly Color ChalkYel  = From("#f0d060");

  public static readonly Color SealRed   = From("#c0392b");
  public static readonly Color SealDark  = From("#9c2f22");
  public static readonly Color SealPaper = From("#f2e8d0");

  public static readonly Color SteelLit  = From("#b0c0cc");
  public static readonly Color SteelBase = From("#8a9aa8");
  public static readonly Color SteelMid  = From("#5c6c7a");
  public static readonly Color SteelDark = From("#3d4a55");
  public static readonly Color SteelDeep = From("#2c3640");
  public static readonly Color SteelShine= From("#d8e2e8");

  public static readonly Color GlassHi   = From("#fff0c8");
  public static readonly Color GlassA    = From("#ffd9a0");
  public static readonly Color GlassB    = From("#ffb878");
  public static readonly Color GlassC    = From("#ff9e58");
  public static readonly Color DoorGlass = From("#ffe9b0");

  public static readonly Color GoldHi    = From("#fff4c0");
  public static readonly Color GoldA     = From("#ffe27a");
  public static readonly Color GoldB     = From("#ffc93c");
  public static readonly Color GoldC     = From("#e8940f");
  public static readonly Color GoldDeep  = From("#a86a10");

  public static readonly Color RedBase   = From("#c43b3b");
  public static readonly Color RedLight  = From("#e05a4a");
  public static readonly Color RedDark   = From("#9c2828");
  public static readonly Color BannerTxt = From("#f2e8c0");

  public static readonly Color LeafBase  = From("#3d7a3c");
  public static readonly Color LeafLight = From("#5aa050");
  public static readonly Color LeafDark  = From("#2c5a2c");
  public static readonly Color PotBase   = From("#b0603a");
  public static readonly Color PotLight  = From("#c97a4a");
  public static readonly Color PotDark   = From("#8a4530");

  public static readonly Color PaperHi   = From("#f7f2e2");
  public static readonly Color PaperDim  = From("#e8e0c8");
  public static readonly Color InkGray   = From("#b0a890");
  public static readonly Color InkDark   = From("#6a6455");
  public static readonly Color HandDark  = From("#3d3d3d");
  public static readonly Color HandRed   = From("#c0392b");
  public static readonly Color CardBlue  = From("#5878a0");
  public static readonly Color DogPaw    = From("#e8b84a");

  public static Color From(string hex){ return ColorTranslator.FromHtml(hex); }

  // ---------- tiny canvas ----------
  public class Px {
    public int W, H;
    public Color[,] c;
    public Px(int w, int h){ W=w; H=h; c=new Color[w,h];
      Color t = Color.FromArgb(0,0,0,0);
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) c[x,y]=t; }
    public bool In(int x,int y){ return x>=0 && y>=0 && x<W && y<H; }
    public void P(int x,int y,Color col){ if(In(x,y)) c[x,y]=col; }
    public void Fill(Color col){ for(int y=0;y<H;y++) for(int x=0;x<W;x++) c[x,y]=col; }
    public void Clear(){ Fill(Color.FromArgb(0,0,0,0)); }
    public void R(int x,int y,int w,int h,Color col){
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j,col); }
    public void HL(int x,int y,int w,Color col){ R(x,y,w,1,col); }
    public void V(int x,int y,int h,Color col){ R(x,y,1,h,col); }
    public void D(int x,int y,int w,int h,Color a,Color b){ // checker dither
      for(int j=y;j<y+h;j++) for(int i=x;i<x+w;i++) P(i,j, ((i+j)&1)==0 ? a : b); }
    public void ShadowUnder(int x,int w){ // 1px soft ground shadow
      HL(x, H-1, w, Color.FromArgb(70, 60, 30, 10)); }
    public Px Clone(){ Px p=new Px(W,H); for(int y=0;y<H;y++) for(int x=0;x<W;x++) p.c[x,y]=c[x,y]; return p; }
  }

  // split a big canvas into 16x16 tiles named tl,tm,tr / ml,mm,mr / bl,bm,br
  public static Dictionary<string,Px> Split3x3(Px src, string prefix){
    var d = new Dictionary<string,Px>();
    string[] sfx = {"tl","tm","tr","ml","mm","mr","bl","bm","br"};
    for(int i=0;i<9;i++){
      int cx=(i%3)*16, cy=(i/3)*16;
      Px t=new Px(16,16);
      for(int y=0;y<16;y++) for(int x=0;x<16;x++) t.c[x,y]=src.c[cx+x,cy+y];
      d[prefix+"_"+sfx[i]]=t;
    }
    return d;
  }
  public static Dictionary<string,Px> Split2x2(Px src, string prefix){
    var d = new Dictionary<string,Px>();
    string[] sfx = {"tl","tr","bl","br"};
    for(int i=0;i<4;i++){
      int cx=(i%2)*16, cy=(i/2)*16;
      Px t=new Px(16,16);
      for(int y=0;y<16;y++) for(int x=0;x<16;x++) t.c[x,y]=src.c[cx+x,cy+y];
      d[prefix+"_"+sfx[i]]=t;
    }
    return d;
  }

  // ================= STAGE 1 TILES =================
  public static Px FloorA(){
    Px p=new Px(16,16); p.Fill(FloorBase);
    p.HL(0,0,16,FloorHi);
    p.R(0,15,16,1,FloorGrout); p.V(15,0,16,FloorGrout);
    // wear speckles
    p.P(3,4,FloorMid); p.P(9,7,FloorMid); p.P(5,11,FloorMid); p.P(12,3,FloorMid);
    p.P(7,9,FloorDark); p.P(2,8,FloorMid); p.P(11,12,FloorDark);
    p.P(6,2,FloorSpec); p.P(13,9,FloorSpec);
    return p;
  }
  public static Px FloorB(){
    Px p=FloorA();
    // diagonal crack
    p.P(4,5,FloorGrout); p.P(5,6,FloorGrout); p.P(6,6,FloorGrout);
    p.P(7,7,FloorGrout); p.P(8,8,FloorGrout); p.P(9,9,FloorGrout);
    p.P(10,10,FloorGrout); p.P(11,10,FloorGrout);
    return p;
  }
  public static Px FloorEdge(){
    Px p=new Px(16,16); p.Fill(FloorBase);
    p.HL(0,0,16,FloorSpec); p.HL(0,1,16,FloorHi);
    p.R(0,13,16,1,FloorDark); p.R(0,14,16,1,FloorGrout); p.R(0,15,16,1,FloorDeep);
    p.P(4,6,FloorMid); p.P(10,9,FloorMid); p.P(7,4,FloorSpec);
    return p;
  }
  public static Px FloorDarkT(){
    Px p=new Px(16,16); p.Fill(FloorDark);
    p.R(0,0,16,1,FloorGrout);
    p.R(0,15,16,1,FloorDeep);
    p.P(3,6,FloorGrout); p.P(9,10,FloorGrout); p.P(12,4,FloorMid);
    return p;
  }
  public static Px WallUpper(){
    Px p=new Px(16,16); p.Fill(WallBase);
    p.HL(0,0,16,WallLight);
    p.P(4,6,WallStain); p.P(5,6,WallStain); p.P(12,11,WallStain2);
    p.P(9,3,WallStain2); p.P(2,13,WallStain2); p.P(3,13,WallStain2);
    return p;
  }
  public static Px WallUpperB(){
    Px p=WallUpper();
    p.V(6,1,14,WallStain2); p.V(7,2,13,WallStain); // faint drip streak
    return p;
  }
  public static Px WallTrim(){
    Px p=new Px(16,16);
    p.Fill(GreenBase);
    p.R(0,0,16,4,WoodMid); p.HL(0,0,16,WoodBase); p.HL(0,3,16,WoodDark);
    p.HL(0,4,16,GreenLight);
    p.P(3,8,GreenDark); p.P(10,11,GreenDark); p.P(6,13,GreenDark);
    return p;
  }
  public static Px WallLower(){
    Px p=new Px(16,16); p.Fill(GreenBase);
    p.HL(0,0,16,GreenLight);
    p.P(5,5,GreenDark); p.P(11,8,GreenDark); p.P(2,12,GreenDark); p.P(8,3,GreenDark);
    p.P(13,13,GreenDark); p.P(7,10,GreenLight);
    return p;
  }
  public static Px WallBaseT(){
    Px p=new Px(16,16); p.Fill(GreenDark);
    p.HL(0,0,16,GreenLight);
    p.R(0,4,16,12,GreenDeep);
    p.P(4,8,GreenDark); p.P(10,12,GreenDark);
    return p;
  }
  public static Px Window(){
    Px p=new Px(16,16);
    p.Fill(WoodDark);                       // frame
    p.R(2,2,12,12,GlassB);                  // glass base
    p.R(2,2,12,4,GlassA);                   // sky band
    p.R(2,2,12,2,GlassHi);
    p.R(2,10,12,4,GlassC);                  // sunset band
    // sun disc top-left pane
    p.R(4,3,3,3,GlassHi); p.P(3,4,GlassHi); p.P(7,4,GlassHi); p.P(4,2,GlassHi); p.P(4,6,GlassHi); p.P(6,6,GlassHi);
    // muntins
    p.V(7,2,12,WoodMid); p.HL(2,7,12,WoodMid);
    p.R(1,1,14,1,WoodBase); p.R(1,14,14,1,WoodDeep);
    return p;
  }
  public static Px Windowsill(){
    Px p=new Px(16,16); p.Fill(WallBase);
    p.R(0,7,16,3,WoodBase); p.HL(0,7,16,WoodHi); p.HL(0,9,16,WoodMid);
    p.R(0,10,16,1,WoodDark);
    p.R(0,11,16,2,WallStain2);              // wall shadow under sill
    return p;
  }
  public static Px DoorTop(){
    Px p=new Px(16,16); p.Fill(WoodDark);
    p.R(1,0,14,16,WoodBase);
    p.R(3,3,10,8,DoorGlass);                // glass
    p.R(3,3,10,1,GlassHi);
    p.V(7,3,8,WoodMid); p.HL(3,6,10,WoodMid);// muntin cross
    p.R(3,13,10,2,WoodMid);                 // panel groove
    p.R(1,0,14,1,WoodHi);
    return p;
  }
  public static Px DoorBottom(){
    Px p=new Px(16,16); p.Fill(WoodDark);
    p.R(1,0,14,16,WoodBase);
    p.R(3,2,10,4,WoodMid);                  // upper panel
    p.R(3,8,10,4,WoodMid);                  // lower panel
    p.R(4,3,8,1,WoodHi); p.R(4,9,8,1,WoodHi);
    p.R(12,5,2,2,SteelShine);               // handle
    p.R(1,14,14,2,WoodDark);
    return p;
  }
  public static Px Beam(){
    Px p=new Px(16,16);
    p.R(0,4,16,8,WoodMid);
    p.HL(0,4,16,WoodBase); p.HL(0,5,16,WoodHi);
    p.HL(0,10,16,WoodDark); p.HL(0,11,16,WoodDeep);
    p.V(3,6,4,WoodDark); p.V(9,7,3,WoodDark); p.V(13,6,3,WoodDark); // grain
    return p;
  }
  public static Px WallClock(){
    Px p=new Px(16,16);
    // rim circle
    for(int y=0;y<16;y++) for(int x=0;x<16;x++){
      int dx=x-7, dy=y-7, d2=dx*dx+dy*dy;
      if(d2<=36) p.P(x,y,WoodMid);
      if(d2<=25) p.P(x,y,PaperHi);
    }
    p.P(7,3,HandDark); p.P(8,3,HandDark);   // 12 tick
    p.P(3,7,HandDark); p.P(11,7,HandDark);  // 3/9 ticks
    p.P(7,11,HandDark); p.P(8,11,HandDark);
    p.V(7,5,4,HandDark);                    // hour hand
    p.HL(7,7,3,HandDark); p.P(9,6,HandDark); // minute hand
    p.P(8,4,HandRed); p.P(8,5,HandRed);     // red second
    p.P(7,7,HandDark);
    return p;
  }
  public static Px HonorRoll(){
    Px p=new Px(16,16);
    p.R(2,1,12,14,PaperHi);
    p.R(2,1,12,1,RedBase); p.R(2,14,12,1,RedDark);
    p.V(2,1,14,RedBase); p.V(13,1,14,RedDark);
    p.R(4,3,8,2,RedBase);                   // title block
    p.P(5,2,BannerTxt); p.P(7,2,BannerTxt); p.P(9,2,BannerTxt);
    for(int i=0;i<4;i++){ p.HL(4,6+i*2,8,InkGray); p.P(11,6+i*2,InkDark); }
    p.P(3,0,SteelMid);                      // pin
    return p;
  }
  public static Px BannerRed(){
    Px p=new Px(16,16);
    p.R(0,4,16,8,RedBase);
    p.HL(0,4,16,RedLight); p.HL(0,11,16,RedDark);
    p.V(0,4,8,RedLight); p.V(15,4,8,RedDark);   // cloth wave shading
    p.P(0,12,RedDark); p.P(15,3,RedLight);
    for(int i=0;i<5;i++){ p.R(2+i*3,7,2,2,BannerTxt); } // text blocks
    return p;
  }
  public static Px Plant(){
    Px p=new Px(16,16);
    // bush
    p.R(3,3,10,6,LeafBase);
    p.R(4,1,8,4,LeafBase);
    p.P(5,2,LeafLight); p.P(6,1,LeafLight); p.P(9,2,LeafLight); p.P(10,3,LeafLight);
    p.P(4,4,LeafLight); p.P(8,4,LeafLight); p.P(11,5,LeafLight);
    p.P(6,6,LeafDark); p.P(9,7,LeafDark); p.P(4,7,LeafDark);
    // pot
    p.R(4,9,8,2,PotLight);
    p.R(3,11,10,4,PotBase); p.V(3,11,4,PotDark);
    p.R(4,15,8,1,PotDark);
    return p;
  }
  public static Px TrashBin(){
    Px p=new Px(16,16);
    p.R(4,3,8,2,SteelLit);                  // lid
    p.HL(5,2,6,SteelBase);
    p.R(5,5,6,1,SteelShine);                // lid handle
    p.R(3,5,10,9,SteelBase);
    p.V(3,5,9,SteelMid); p.V(12,5,9,SteelDark);
    p.HL(3,8,10,SteelMid);
    p.R(3,14,10,1,SteelDark);
    p.V(5,6,7,SteelShine);                  // body shine
    return p;
  }
  public static Px PaperScrap(){
    Px p=new Px(16,16);
    p.R(3,11,5,4,PaperHi); p.P(3,11,PaperDim); p.P(7,14,PaperDim);
    p.R(9,12,5,3,PaperDim); p.R(10,11,3,1,PaperHi);
    p.HL(3,15,11,Color.FromArgb(60,90,50,20));
    p.P(6,12,InkGray); p.P(11,13,InkGray);
    return p;
  }
  public static Px ChalkDust(){
    Px p=new Px(16,16);
    p.R(3,12,5,1,Chalk); p.P(3,11,ChalkDim);
    p.R(10,13,4,1,ChalkYel);
    p.P(6,14,ChalkDim); p.P(9,11,ChalkDim); p.P(2,14,ChalkDim); p.P(14,12,ChalkDim);
    return p;
  }
  public static Px BooksStack(){
    Px p=new Px(16,16);
    p.R(2,11,12,3,RedBase); p.HL(2,11,12,RedLight); p.R(2,13,12,1,RedDark);
    p.R(10,12,4,1,PaperHi);                 // pages
    p.R(3,8,11,3,LeafBase); p.HL(3,8,11,LeafLight); p.R(3,10,11,1,LeafDark);
    p.R(10,9,3,1,PaperHi);
    p.R(4,5,9,3,GlassB); p.HL(4,5,9,GlassA); p.R(4,7,9,1,WoodMid);
    p.R(9,6,3,1,PaperHi);
    return p;
  }
  public static Px BbSealed(){
    Px p=new Px(16,16);
    p.Fill(WoodMid); p.HL(0,0,16,WoodBase); p.R(0,15,16,1,WoodDark);
    p.R(2,2,12,12,BoardBase);
    p.R(2,2,12,1,BoardLit);
    // two paper seals
    p.R(4,3,2,10,SealRed); p.V(4,3,10,SealLight(SealRed)); p.HL(4,12,2,SealDark);
    p.R(10,3,2,10,SealRed); p.V(10,3,10,SealLight(SealRed)); p.HL(10,12,2,SealDark);
    p.P(4,5,SealPaper); p.P(10,6,SealPaper); p.P(4,9,SealPaper); p.P(10,9,SealPaper);
    // faint chalk marks between
    p.HL(7,6,2,ChalkDim); p.P(8,9,ChalkDim);
    return p;
  }
  static Color SealLight(Color c){ return Color.FromArgb(255, Math.Min(255,c.R+40), Math.Min(255,c.G+40), Math.Min(255,c.B+40)); }
  public static Px BbSealedBroken(){
    Px p=BbSealed();
    // torn seals (jagged)
    p.R(4,3,2,4,SealRed); p.P(4,7,SealDark); p.P(5,8,SealDark);
    p.R(10,8,2,5,SealRed); p.P(10,7,SealDark); p.P(11,6,SealDark);
    // scratches on board
    p.P(6,6,ChalkDim); p.P(7,7,ChalkDim); p.P(8,6,ChalkDim);
    p.P(5,10,ChalkDim); p.P(9,11,ChalkDim);
    // falling scrap
    p.P(7,13,SealPaper); p.P(12,2,SealPaper); p.P(2,5,SealPaper);
    return p;
  }
  public static Px PodiumTop(){
    Px p=new Px(16,16);
    p.R(0,0,16,4,WoodHi); p.HL(0,0,16,Color.FromArgb(255,230,170,110));
    p.R(0,4,16,12,WoodMid);
    p.HL(0,4,16,WoodBase); p.R(0,13,16,1,WoodDark); p.R(0,15,16,1,WoodDeep);
    p.V(2,6,7,WoodDark); p.V(9,7,5,WoodDark); p.V(13,6,6,WoodDark); // grain
    return p;
  }
  public static Px PodiumBase(){
    Px p=new Px(16,16);
    p.R(3,0,10,16,WoodMid);
    p.V(3,0,16,WoodBase); p.V(12,0,16,WoodDark);
    p.R(4,3,8,1,WoodDark); p.R(4,9,8,1,WoodDark); // panel grooves
    p.R(2,14,12,2,WoodDeep);                // plinth
    p.R(3,0,10,1,WoodDark);
    return p;
  }
  public static Px DeskLeft(){
    Px p=new Px(16,16);
    p.R(0,2,16,3,WoodHi); p.HL(0,2,16,From("#e6aa6e"));
    p.R(0,5,16,2,WoodMid);
    p.V(0,2,3,WoodDark);                    // left edge cap
    p.R(1,7,3,9,WoodDeep);                  // left leg
    p.P(2,7,WoodDark);
    p.P(6,9,WoodDark); p.P(11,10,WoodDark); // under shadow hints
    p.R(4,7,4,2,SteelMid);                  // crossbar
    return p;
  }
  public static Px DeskMid(){
    Px p=new Px(16,16);
    p.R(0,2,16,3,WoodHi); p.HL(0,2,16,From("#e6aa6e"));
    p.R(0,5,16,2,WoodMid);
    p.P(4,9,WoodDark); p.P(10,10,WoodDark); p.P(13,9,WoodDark);
    p.R(5,7,6,2,SteelMid);
    return p;
  }
  public static Px DeskRight(){
    Px p=new Px(16,16);
    p.R(0,2,16,3,WoodHi); p.HL(0,2,16,From("#e6aa6e"));
    p.R(0,5,16,2,WoodMid);
    p.V(15,2,3,WoodDark);                   // right edge cap
    p.R(12,7,3,9,WoodDeep);                 // right leg
    p.P(13,7,WoodDark);
    p.P(6,9,WoodDark); p.P(9,10,WoodDark);
    p.R(6,7,5,2,SteelMid);
    return p;
  }
  public static Px DeskSingle(){
    Px p=new Px(16,16);
    p.R(1,2,14,3,WoodHi); p.HL(1,2,14,From("#e6aa6e"));
    p.R(1,5,14,2,WoodMid);
    p.V(1,2,3,WoodDark); p.V(14,2,3,WoodDark);
    p.R(2,7,3,9,WoodDeep); p.R(11,7,3,9,WoodDeep);
    p.R(5,7,6,2,SteelMid);
    // a book on top
    p.R(5,0,6,2,RedBase); p.HL(5,0,6,RedLight); p.R(9,0,2,2,PaperHi);
    return p;
  }
  // 48x48 blackboard, chalk writing, tray at bottom
  public static Px BlackboardBig(){
    Px p=new Px(48,48);
    p.Fill(WoodMid);
    p.R(0,0,48,1,WoodBase); p.R(0,47,48,1,WoodDeep);
    p.V(0,0,48,WoodBase); p.V(47,0,48,WoodDeep);
    p.R(3,3,42,42,BoardBase);
    p.R(3,3,42,1,BoardLit); p.R(3,3,1,42,BoardLit);
    p.R(3,43,42,1,WoodDark); p.R(44,3,1,41,WoodDark);
    // chalk smudge bands
    p.R(6,20,30,1,BoardLit); p.R(20,34,18,1,BoardLit);
    // chalk writing line 1 (white)
    int[,] w1 = {{6,8,1},{7,8,1},{8,9,1},{9,9,1},{10,8,1},{11,7,1},{12,7,1},{13,8,1},{14,9,1},{15,9,1},{16,8,1},{18,8,1},{19,8,1},{20,8,1},{21,8,1},{22,8,1},{23,7,1},{24,8,1}};
    for(int i=0;i<w1.GetLength(0);i++) p.P(w1[i,0],w1[i,1],Chalk);
    p.V(17,6,5,Chalk);                       // "1" slash
    p.HL(6,11,8,ChalkDim);                    // underline
    p.HL(18,11,6,ChalkDim);
    // line 2 (yellow)
    int[,] y1 = {{7,16,1},{8,15,1},{9,16,1},{11,15,1},{12,16,1},{13,15,1},{14,16,1},{16,16,1},{17,16,1},{18,15,1},{19,16,1}};
    for(int i=0;i<y1.GetLength(0);i++) p.P(y1[i,0],y1[i,1],ChalkYel);
    p.R(21,14,6,5,ChalkDim); p.R(22,15,4,3,BoardBase); // little box plot
    // line 3 diagram
    p.V(8,24,8,Chalk); p.HL(8,31,7,Chalk); p.V(14,26,5,Chalk);
    p.P(20,28,Chalk); p.P(21,27,Chalk); p.P(22,28,Chalk); p.P(23,29,Chalk); p.P(24,28,Chalk);
    p.HL(27,22,12,ChalkYel); p.V(30,22,8,ChalkYel);
    p.P(38,10,Chalk); p.P(39,11,Chalk); p.P(40,12,Chalk); p.P(41,13,Chalk);
    // chalk tray
    p.R(6,44,36,2,WoodDark); p.R(6,44,36,1,WoodMid);
    p.R(10,43,4,1,Chalk); p.R(18,43,3,1,ChalkYel); p.R(28,43,4,1,ChalkDim);
    return p;
  }
  public static Px LockerBig(){
    Px p=new Px(32,32);
    p.Fill(SteelBase);
    p.R(0,0,32,2,SteelLit);                 // top
    p.R(0,30,32,2,SteelDark);               // feet shadow
    p.V(15,2,28,SteelDark);                 // gap between two lockers
    // left door
    p.R(1,3,13,3,SteelDeep); p.R(2,4,11,1,SteelDeep); // vent 1
    p.R(1,7,13,3,SteelDeep); p.R(2,8,11,1,SteelDeep); // vent 2
    p.R(1,11,13,3,SteelDeep); p.R(2,12,11,1,SteelDeep);// vent 3
    p.R(11,18,2,5,SteelShine);              // handle
    p.V(0,2,28,SteelMid);                   // left frame shade
    // right door
    p.R(17,3,13,3,SteelDeep); p.R(18,4,11,1,SteelDeep);
    p.R(17,7,13,3,SteelDeep); p.R(18,8,11,1,SteelDeep);
    p.R(17,11,13,3,SteelDeep); p.R(18,12,11,1,SteelDeep);
    p.R(27,18,2,5,SteelShine);
    p.V(31,2,28,SteelMid);
    // name sticker
    p.R(5,20,6,4,PaperHi); p.HL(6,21,4,InkGray);
    p.R(21,20,6,4,PaperHi); p.HL(22,21,4,InkGray);
    return p;
  }

  // ================= EASTER EGG SPRITES =================
  public static Px BoxBase(int wiggle){
    Px p=new Px(16,16);
    int dy=wiggle; // content shift for trembling
    // body
    p.R(2,6,12,9,From("#c99055"));
    p.R(2,6,12,1,From("#dba76b"));
    p.R(2,14,12,1,From("#9c6f3c"));
    p.V(2,6,9,From("#dba76b")); p.V(13,6,9,From("#a87c46"));
    // top flaps
    p.R(1,4+dy,6,2,From("#b8834c")); p.R(9,4+dy,6,2,From("#b8834c"));
    p.HL(1,4+dy,6,From("#cfa266")); p.HL(9,4+dy,6,From("#cfa266"));
    // tape
    p.R(7,4+dy,2,11,From("#e8d8b0"));
    p.P(7,8+dy,From("#d8c898")); p.P(8,11+dy,From("#d8c898"));
    // fragile mark
    p.R(3,9,2,2,SealRed); p.P(4,10,SealRed);
    // ground shadow
    p.HL(2,15,12,Color.FromArgb(70,90,50,20));
    return p;
  }
  public static Px BoxClosed(){ return BoxBase(0); }
  public static Px BoxTrembleA(){ Px p=BoxBase(0); p.R(2,5,12,1,Color.FromArgb(0,0,0,0)); p.R(1,4,6,1,From("#b8834c")); p.R(9,4,6,1,From("#b8834c")); p.HL(1,3,6,From("#cfa266")); p.HL(9,3,6,From("#cfa266")); p.R(7,3,2,12,From("#e8d8b0")); return p; }
  public static Px BoxTrembleB(){ return BoxBase(1); }
  public static Px BoxOpen(){
    Px p=new Px(16,16);
    p.R(2,7,12,8,From("#c99055"));
    p.R(2,7,12,1,From("#dba76b"));
    p.R(2,14,12,1,From("#9c6f3c"));
    p.V(2,7,8,From("#dba76b")); p.V(13,7,8,From("#a87c46"));
    // open flaps tilted out
    p.R(0,5,4,2,From("#b8834c")); p.R(12,5,4,2,From("#b8834c"));
    p.R(0,3,3,2,From("#cfa266")); p.R(13,3,3,2,From("#cfa266"));
    // dark interior
    p.R(3,8,10,3,From("#4a3418"));
    // puppy ears peeking
    p.R(6,8,2,2,DogPaw); p.R(9,8,2,2,DogPaw);
    p.P(6,9,From("#c99a2e")); p.P(11,9,From("#c99a2e"));
    p.HL(2,15,12,Color.FromArgb(70,90,50,20));
    return p;
  }
  public static Px BubbleWuu(){
    Px p=new Px(16,16);
    // rounded bubble
    p.R(3,3,9,7,PaperHi);
    p.R(4,2,7,1,PaperHi); p.R(4,10,7,1,PaperHi);
    p.P(2,4,PaperHi); p.P(2,8,PaperHi); p.P(12,4,PaperHi); p.P(12,8,PaperHi);
    p.P(3,2,PaperHi); p.P(11,2,PaperHi); p.P(3,10,PaperHi); p.P(11,10,PaperHi);
    // tail
    p.P(4,11,PaperHi); p.P(3,12,PaperHi); p.P(2,13,PaperHi);
    // whimper squiggles
    p.P(5,5,CardBlue); p.P(6,6,CardBlue); p.P(5,7,CardBlue);
    p.P(9,5,CardBlue); p.P(10,6,CardBlue); p.P(9,7,CardBlue);
    return p;
  }
  public static Px AnswerCard(bool shine){
    Px p=new Px(16,16);
    // glow halo
    Color halo = shine ? GoldA : Color.FromArgb(120,255,226,122);
    p.R(1,2,14,11,halo);
    p.R(2,1,12,13,halo);
    // card body
    p.R(3,3,10,8,PaperHi);
    p.R(3,3,10,1,Color.FromArgb(255,255,255,246));
    p.R(3,10,10,1,PaperDim);
    p.V(3,3,8,PaperDim);
    p.R(12,3,1,8,PaperDim);
    // red border + marks
    p.HL(3,3,10,RedBase); p.V(3,3,8,RedBase);
    p.P(12,3,RedDark); p.P(3,10,RedDark);
    p.R(5,5,6,1,InkDark);                   // answer line
    p.HL(5,5,3,InkDark);
    p.R(5,7,4,1,InkGray);
    p.P(11,5,RedBase);                      // check mark start
    p.P(11,6,RedBase); p.P(10,6,RedBase);
    // sparkles
    p.P(1,1,GoldHi); p.P(14,12,GoldHi);
    if(shine){ p.P(2,4,GoldHi); p.P(13,2,GoldHi); p.P(7,12,GoldA); }
    else { p.P(13,1,GoldA); p.P(2,11,GoldA); }
    return p;
  }
  public static Px Thermos(bool shine){
    Px p=new Px(16,16);
    // cup lid (gold)
    p.R(5,1,6,3,GoldB); p.HL(5,1,6,GoldHi); p.R(5,3,6,1,GoldC);
    // neck
    p.R(6,4,4,1,SteelMid);
    // body
    p.R(4,5,8,9,SteelBase);
    p.V(4,5,9,SteelMid); p.V(11,5,9,SteelDark);
    p.V(6,5,9,SteelShine);                  // vertical shine
    p.R(8,6,1,7,From("#ffe9b0"));           // warm ambient reflection
    p.R(4,13,8,1,SteelDark);
    p.R(3,14,10,1,SteelDeep);               // base
    p.HL(3,15,10,Color.FromArgb(70,90,50,20));
    if(shine){ p.P(9,6,GoldHi); p.P(10,7,GoldHi); p.P(7,9,SteelShine); }
    else { p.P(9,8,SteelShine); }
    return p;
  }

  // ---------- png io ----------
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
      Color c=src.c[x,y];
      if(c.A>0 && dst.In(ox+x,oy+y)) dst.c[ox+x,oy+y]=c;
    }
  }

  public class Frame { public string name; public Px px; public string role; public bool solid; public string note; }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies @("System.Drawing") -Language CSharp

# ================= build stage1 tileset =================
$tiles = New-Object System.Collections.Generic.List[object]
function Add-Tile([string]$name, $px, [string]$role, [bool]$solid, [string]$note){
  $f = New-Object Gen+Frame
  $f.name=$name; $f.px=$px; $f.role=$role; $f.solid=$solid; $f.note=$note
  $tiles.Add($f)
}

Add-Tile "floor_a"      ([Gen]::FloorA())     "ground" $true  "repeatable corridor floor"
Add-Tile "floor_b"      ([Gen]::FloorB())     "ground" $true  "floor variation, mix with floor_a"
Add-Tile "floor_edge"   ([Gen]::FloorEdge())  "ground" $true  "platform/ground top edge"
Add-Tile "floor_dark"   ([Gen]::FloorDarkT())  "ground" $true  "floor under-layer / depth"
Add-Tile "wall_upper"   ([Gen]::WallUpper())  "decor"  $false "cream plaster wall"
Add-Tile "wall_upper_b" ([Gen]::WallUpperB()) "decor"  $false "wall variation with streak"
Add-Tile "wall_trim"    ([Gen]::WallTrim())   "decor"  $false "wood rail between upper wall and green wainscot"
Add-Tile "wall_lower"   ([Gen]::WallLower())  "decor"  $false "school green wainscot"
Add-Tile "wall_base"    ([Gen]::WallBaseT())   "decor"  $false "dark baseboard, bottom of wall"
Add-Tile "window"       ([Gen]::Window())     "decor"  $false "sunset window, place 1 tile above windowsill"
Add-Tile "windowsill"   ([Gen]::Windowsill()) "decor"  $false "sill under window"
Add-Tile "door_top"     ([Gen]::DoorTop())    "decor"  $false "classroom door upper, stack over door_bottom"
Add-Tile "door_bottom"  ([Gen]::DoorBottom()) "decor"  $false "classroom door lower"
Add-Tile "beam"         ([Gen]::Beam())       "platform" $true "wooden beam over blackboard, answer-card perch (1x N tiling)"
Add-Tile "wall_clock"   ([Gen]::WallClock())  "decor"  $false "wall clock"
Add-Tile "honor_roll"   ([Gen]::HonorRoll())  "decor"  $false "honor roll poster"
Add-Tile "banner_red"   ([Gen]::BannerRed())  "decor"  $false "red banner, horizontal tiling"
Add-Tile "plant"        ([Gen]::Plant())      "decor"  $false "potted plant, floor prop"
Add-Tile "trash_bin"    ([Gen]::TrashBin())   "decor"  $false "trash bin, floor prop"
Add-Tile "paper_scrap"  ([Gen]::PaperScrap()) "decor"  $false "paper scatter, floor prop"
Add-Tile "chalk_dust"   ([Gen]::ChalkDust())  "decor"  $false "chalk sticks and dust, floor prop"
Add-Tile "books_stack"  ([Gen]::BooksStack()) "decor"  $false "book stack, desk/floor prop"
Add-Tile "bb_sealed"        ([Gen]::BbSealed())       "breakable" $true  "small sealed board, smash with J; swap to bb_sealed_broken"
Add-Tile "bb_sealed_broken" ([Gen]::BbSealedBroken()) "breakable" $false "broken state of bb_sealed"
Add-Tile "podium_top"   ([Gen]::PodiumTop())  "platform" $true "podium surface, stack over podium_base; jump board to beam"
Add-Tile "podium_base"  ([Gen]::PodiumBase()) "platform" $true "podium base"
Add-Tile "desk_left"    ([Gen]::DeskLeft())   "platform" $true "desk row left cap"
Add-Tile "desk_mid"     ([Gen]::DeskMid())    "platform" $true "desk row middle, tiling"
Add-Tile "desk_right"   ([Gen]::DeskRight())  "platform" $true "desk row right cap"
Add-Tile "desk_single"  ([Gen]::DeskSingle()) "platform" $true "standalone desk with book"
$bb = [Gen]::Split3x3([Gen]::BlackboardBig(), "bb")
Add-Tile "bb_tl" $bb["bb_tl"] "decor" $false "big blackboard 3x3: top-left"
Add-Tile "bb_tm" $bb["bb_tm"] "decor" $false "big blackboard 3x3: top-mid"
Add-Tile "bb_tr" $bb["bb_tr"] "decor" $false "big blackboard 3x3: top-right"
Add-Tile "bb_ml" $bb["bb_ml"] "decor" $false "big blackboard 3x3: mid-left"
Add-Tile "bb_mm" $bb["bb_mm"] "decor" $false "big blackboard 3x3: center"
Add-Tile "bb_mr" $bb["bb_mr"] "decor" $false "big blackboard 3x3: mid-right"
Add-Tile "bb_bl" $bb["bb_bl"] "decor" $false "big blackboard 3x3: bottom-left"
Add-Tile "bb_bm" $bb["bb_bm"] "decor" $false "big blackboard 3x3: bottom-mid"
Add-Tile "bb_br" $bb["bb_br"] "decor" $false "big blackboard 3x3: bottom-right"
$lk = [Gen]::Split2x2([Gen]::LockerBig(), "locker")
Add-Tile "locker_tl" $lk["locker_tl"] "platform" $true "locker 2x2: top-left"
Add-Tile "locker_tr" $lk["locker_tr"] "platform" $true "locker 2x2: top-right"
Add-Tile "locker_bl" $lk["locker_bl"] "platform" $true "locker 2x2: bottom-left"
Add-Tile "locker_br" $lk["locker_br"] "platform" $true "locker 2x2: bottom-right"

# sheet 256x256, 16 tiles per row
$sheet = New-Object Gen+Px 256,256
$jsonFrames = New-Object System.Collections.Generic.List[string]
for($i=0; $i -lt $tiles.Count; $i++){
  $t = $tiles[$i]
  $x = ($i % 16) * 16; $y = [math]::Floor($i / 16) * 16
  [Gen]::Blit($sheet, $t.px, $x, $y)
  $j = '{{"filename":"{0}","frame":{{"x":{1},"y":{2},"w":16,"h":16}},"rotated":false,"trimmed":false,"spriteSourceSize":{{"x":0,"y":0,"w":16,"h":16}},"sourceSize":{{"w":16,"h":16}},"meta":{{"role":"{3}","solid":{4},"note":"{5}"}}}}' -f $t.name,$x,$y,$t.role,($t.solid.ToString().ToLower()),$t.note
  $jsonFrames.Add($j)
}
$sheetPath = Join-Path $out "school_corridor.png"
[Gen]::SavePx($sheet, $sheetPath)
$json = '{"frames":[' + ($jsonFrames -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"school_corridor.png","format":"RGBA8888","size":{"w":256,"h":256},"scale":"1","tileSize":16,"version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $out "school_corridor.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("school_corridor.png + json OK  tiles=" + $tiles.Count)

# ================= easter eggs sheet =================
$eggs = New-Object System.Collections.Generic.List[object]
function Add-Egg([string]$name, $px, [string]$note){
  $f = New-Object Gen+Frame
  $f.name=$name; $f.px=$px; $f.role="easter-egg"; $f.solid=$false; $f.note=$note
  $eggs.Add($f)
}
Add-Egg "box_closed"     ([Gen]::BoxClosed())    "cardboard box, idle"
Add-Egg "box_tremble_a"  ([Gen]::BoxTrembleA())  "tremble loop frame A (flaps up 1px)"
Add-Egg "box_tremble_b"  ([Gen]::BoxTrembleB())  "tremble loop frame B (content down 1px)"
Add-Egg "box_open"       ([Gen]::BoxOpen())      "opened box, puppy ears peek; show after smash+trigger"
Add-Egg "bubble_wuu"     ([Gen]::BubbleWuu())    "whimper bubble, overlay above box, bob up-down"
Add-Egg "answer_card_a"  ([Gen]::AnswerCard($false)) "golden answer card, glow loop A"
Add-Egg "answer_card_b"  ([Gen]::AnswerCard($true))  "golden answer card, glow loop B"
Add-Egg "thermos_a"      ([Gen]::Thermos($false)) "thermos in tea-room gap, glint loop A (level 2)"
Add-Egg "thermos_b"      ([Gen]::Thermos($true))  "thermos glint loop B (level 2)"

$esheet = New-Object Gen+Px 144,16
$ejson = New-Object System.Collections.Generic.List[string]
for($i=0; $i -lt $eggs.Count; $i++){
  $t=$eggs[$i]; $x=$i*16
  [Gen]::Blit($esheet, $t.px, $x, 0)
  $j = '{{"filename":"{0}","frame":{{"x":{1},"y":0,"w":16,"h":16}},"rotated":false,"trimmed":false,"spriteSourceSize":{{"x":0,"y":0,"w":16,"h":16}},"sourceSize":{{"w":16,"h":16}},"meta":{{"role":"easter-egg","solid":false,"note":"{2}"}}}}' -f $t.name,$x,$t.note
  $ejson.Add($j)
}
[Gen]::SavePx($esheet, (Join-Path $out "easter_eggs.png"))
$ejsonStr = '{"frames":[' + ($ejson -join ",") + '],"meta":{"app":"FORGET-ME-NOT tilegen by member-B","image":"easter_eggs.png","format":"RGBA8888","size":{"w":144,"h":16},"scale":"1","tileSize":16,"version":"1.0"}}'
[System.IO.File]::WriteAllText((Join-Path $out "easter_eggs.json"), $ejsonStr, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("easter_eggs.png + json OK  sprites=" + $eggs.Count)

# ================= scene mockup 320x176 (20x11 tiles) =================
$S = New-Object Gen+Px 320,176
function Tile([string]$name,[int]$col,[int]$row){
  $t = $tiles | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if($t -eq $null){ throw "tile not found: $name" }
  [Gen]::Blit($S, $t.px, ($col*16), ($row*16))
}
function Egg([string]$name,[int]$col,[int]$row){
  $t = $eggs | Where-Object { $_.name -eq $name } | Select-Object -First 1
  [Gen]::Blit($S, $t.px, ($col*16), ($row*16))
}
# sky glow band at very top (sunlight from corridor end)
$S.R(0,0,320,10,([Gen]::From("#ffe9b0")))
$S.R(0,10,320,6,([Gen]::From("#fdf0cc")))
# ground rows 9-10
for($c=0;$c -lt 20;$c++){
  Tile "floor_edge" $c 9
  if(($c % 3) -eq 2){ Tile "floor_b" $c 10 } else { Tile "floor_a" $c 10 }
}
# wall: rows 0-4 upper cream, row 5 trim, rows 6-8 green, row 8.5 base... use rows 6-7 green, row 8 base for props floor-line
for($c=0;$c -lt 20;$c++){
  for($r=0;$r -le 4;$r++){ if(($c -eq 3 -and $r -eq 2) -or ($c -eq 8 -and $r -eq 3)) { Tile "wall_upper_b" $c $r } else { Tile "wall_upper" $c $r } }
  Tile "wall_trim"  $c 5
  Tile "wall_lower" $c 6
  Tile "wall_lower" $c 7
  Tile "wall_base"  $c 8
}
# big blackboard 3x3 at cols 6-8, rows 2-4
Tile "bb_tl" 6 2; Tile "bb_tm" 7 2; Tile "bb_tr" 8 2
Tile "bb_ml" 6 3; Tile "bb_mm" 7 3; Tile "bb_mr" 8 3
Tile "bb_bl" 6 4; Tile "bb_bm" 7 4; Tile "bb_br" 8 4
# beam above blackboard + golden answer card on it
Tile "beam" 5 1; Tile "beam" 6 1; Tile "beam" 7 1; Tile "beam" 8 1; Tile "beam" 9 1
Egg "answer_card_a" 7 0
# small sealed board (breakable demo) near blackboard
Tile "bb_sealed" 10 4
# windows + sills
Tile "window" 13 2; Tile "windowsill" 13 3
Tile "window" 15 2; Tile "windowsill" 15 3
# honor roll and clock
Tile "honor_roll" 12 2
Tile "wall_clock" 17 2
# banner
Tile "banner_red" 2 1; Tile "banner_red" 3 1; Tile "banner_red" 4 1
# door at col 18, bottom flush with floor
Tile "door_top" 18 7; Tile "door_bottom" 18 8
# desks row
Tile "desk_left" 1 8; Tile "desk_mid" 2 8; Tile "desk_right" 3 8
Tile "desk_left" 11 8; Tile "desk_mid" 12 8
# podium near blackboard
Tile "podium_top" 9 7; Tile "podium_base" 9 8
# lockers, bottom flush with floor
Tile "locker_tl" 15 7; Tile "locker_tr" 16 7; Tile "locker_bl" 15 8; Tile "locker_br" 16 8
# floor props
Tile "plant" 0 8
Tile "trash_bin" 4 8
Tile "paper_scrap" 5 8
Tile "chalk_dust" 10 8
Tile "books_stack" 14 8
Tile "desk_single" 17 8
# easter egg box near corridor corner with whimper bubble
Egg "box_tremble_a" 19 8
Egg "bubble_wuu" 19 7
[Gen]::SavePx($S, (Join-Path $prev "level1_corridor_mockup.png"))
[Gen]::SavePx([Gen]::Scale($S, 4), (Join-Path $prev "level1_corridor_mockup_x4.png"))
Write-Host "mockup OK"

# ================= sprite strip previews (x6) =================
function Strip([string[]]$names, [string]$file){
  $w = $names.Count*16
  $p = New-Object Gen+Px $w,16
  for($i=0;$i -lt $names.Count;$i++){
    $t = $eggs + $tiles | Where-Object { $_.name -eq $names[$i] } | Select-Object -First 1
    [Gen]::Blit($p, $t.px, ($i*16), 0)
  }
  [Gen]::SavePx([Gen]::Scale($p, 6), (Join-Path $prev $file))
}
Strip @("box_closed","box_tremble_a","box_tremble_b","box_open","bubble_wuu") "eggs_box_x6.png"
Strip @("answer_card_a","answer_card_b","thermos_a","thermos_b") "eggs_items_x6.png"
Strip @("bb_sealed","bb_sealed_broken") "sealed_board_x6.png"
Write-Host "strips OK"
Write-Host "ALL DONE"
