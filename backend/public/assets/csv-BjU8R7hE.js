import{c as r}from"./index-BUvXkd4d.js";/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=r("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);function l(e){const n=String(e);return/[",\n;]/.test(n)?`"${n.replace(/"/g,'""')}"`:n}function c(e){return e.map(l).join(";")}function s(e,n){return[c(e),...n.map(c)].join(`
`)}function u(e,n){const a=new Blob(["\uFEFF"+n],{type:"text/csv;charset=utf-8;"}),t=URL.createObjectURL(a),o=document.createElement("a");o.href=t,o.download=e,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(t)}export{i as D,s as a,u as d,c as t};
