import { renderCvHtml } from "./src/services/pdf/cvTemplate.js";
import { htmlToPdf } from "./src/services/pdf/render.js";
import { writeFileSync } from "node:fs";
const cv: any = {
  fullName: "Aakash Kumar", title: "Assistant Manager (Frontend)",
  contact: { email: "a@x.com", phone: "9015844910", location: "Delhi", links: [] },
  summary: "Frontend developer and team lead.",
  skills: ["React","JavaScript","Redux","HTML","CSS","Git","Context API","RESTful API","Material UI","Node.js","Express","SaaS","Sass"],
  experience: Array.from({length:5}).map((_,i)=>({ role:`Role ${i+1} with a long title here`, company:`Company ${i+1} Pvt. Ltd.`, dates:"Jan 2020 – Dec 2021", bullets:["Did a substantial thing that wraps onto multiple lines to test whether an entry gets split across the page boundary.","Second bullet also fairly long to push height.","Third bullet for good measure to increase entry height near a page break."] })),
  education: [{ degree:"B.Tech", institution:"Delhi Technological University", dates:"2012 – 2016" }],
};
const pdf = await htmlToPdf(renderCvHtml(cv));
writeFileSync("./qa_out.pdf", pdf);
console.log("PDF bytes:", pdf.length);
