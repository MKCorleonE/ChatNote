// Shared geometry for the application and the self-contained HTML export.
export const mapLayoutCss = `
.mind-map,.mind-map ul{list-style:none;margin:0;padding:0}
.mind-map li{position:relative;padding:12px 0}
.mind-map .map-row{display:flex;align-items:flex-start;width:max-content}
.mind-map .map-row>ul{position:relative;flex:none;margin-left:40px;padding-left:28px;border-left:0}
.mind-map .map-row>ul:before{content:'';position:absolute;left:-40px;top:55px;width:40px;border-top:2px solid var(--map-line,#b9cfbd)}
.mind-map ul>li:before{content:'';position:absolute;left:-28px;top:55px;width:28px;border-top:2px solid var(--map-line,#b9cfbd)}
.mind-map .map-row>ul>li:after{content:'';position:absolute;left:-28px;top:0;bottom:0;border-left:2px solid var(--map-line,#b9cfbd)}
.mind-map .map-row>ul>li:first-child:after{top:55px}.mind-map .map-row>ul>li:last-child:after{bottom:calc(100% - 55px)}
.mind-map .map-card{width:var(--card-width,360px);min-width:260px;max-width:800px;flex:0 0 auto;resize:horizontal;overflow:auto;position:relative;max-height:none}
.mind-map .map-card:hover{transform:none}
.mind-map .map-card[open]>summary>strong{-webkit-line-clamp:unset}
.mind-map .map-card:not([open])>.map-details{animation:none}
.mind-map .map-card[open]>.map-details{transform-origin:top center;animation:map-unfold .46s cubic-bezier(.22,1.4,.42,1) both}
.map-size-control{padding:12px 28px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:12px;border-bottom:1px solid var(--map-line,#d8e1d5)}
.map-size-control label{display:flex;gap:12px;align-items:center}.map-size-control input{width:140px;accent-color:var(--accent,#6d9e7c)}.map-size-control small{opacity:.7;font-size:11px}.map-size-control output{font-size:11px;min-width:45px}
@keyframes map-unfold{0%{opacity:0;transform:translateY(-10px) scaleY(.92)}60%{opacity:1;transform:translateY(2px) scaleY(1.015)}100%{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.mind-map .map-card:not([open])>.map-details{animation:none}
.mind-map .map-card[open]>.map-details{animation:none!important}}
`;
