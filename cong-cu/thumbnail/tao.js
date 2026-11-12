// Dựng ảnh thumbnail 1280x720 vào anh/video-*.jpg. Chạy: node cong-cu/thumbnail/tao.js
const {chromium}=require('playwright');const path=require('path');
const goc=path.resolve(__dirname,'..','..');
const ds=[
 ['do-go',2,'violet','Xem video bài giảng','Thiết kế|đồ gỗ công nghiệp','Vẽ sao cho xưởng sản xuất được mới là thiết kế.'],
 ['nha-o',1,'blue','Khoá học video','Thiết kế nội thất|căn hộ chung cư','Chủ động triển khai – tự làm được từ dự án nhỏ.'],
 ['du-toan',4,'teal','Khoá học video','Dự toán|thi công nội thất','Làm báo giá bằng Excel, từ file báo giá thật.'],
 ['sale',3,'plum','Khoá học video','Tư vấn thiết kế|cho sale nội thất','Hiểu vật liệu, hiểu xưởng, giao đề bài đúng.'],
 ['cnc',5,'slate','Khoá học video','Ra file cắt CNC|với ABF','Chốt mẫu xong là tự ra file cắt, tránh hỏng ván.'],
];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
for(const [ten,ph,c,k,t,s] of ds){
  const u='file://'+path.join(__dirname,'mau.html')+'?'+new URLSearchParams({c,k,t,s,p:ph});
  await p.goto(u);await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>document.getElementById('p').complete);await p.waitForTimeout(300);
  await p.screenshot({path:path.join(goc,'anh',`video-${ten}.jpg`),type:'jpeg',quality:86});
  console.log('anh/video-'+ten+'.jpg');}
await b.close();})();
