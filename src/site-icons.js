// Supply home-screen artwork while retaining the host links on disable.
export function mountSiteIcons(doc) {
  const originals=[...doc.head.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')];
  const markers=originals.map(link=>{const marker=doc.createComment('cwn icon');link.replaceWith(marker);return {link,marker};});
  const base=new URL('../',import.meta.url);
  const links=[['icon','icons/home-192.png'],['apple-touch-icon','icons/home-512.png'],['manifest','home.webmanifest']].map(([rel,path])=>{
    const link=doc.createElement('link');link.rel=rel;link.href=new URL(path,base).href;
    if(rel==='manifest')link.crossOrigin='use-credentials';else link.type='image/png';
    doc.head.append(link);return link;
  });
  return ()=>{links.forEach(link=>link.remove());markers.forEach(({link,marker})=>marker.replaceWith(link));};
}
