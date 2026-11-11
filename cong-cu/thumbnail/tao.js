// Dựng ảnh thumbnail 1280x720 vào anh/video-*.jpg. Chạy: node cong-cu/thumbnail/tao.js
const {chromium}=require('playwright');const path=require('path');
const goc=path.resolve(__dirname,'..','..');
const ds=[
 ['do-go','violet','Xem video bài giảng','Thiết kế|đồ gỗ công nghiệp','Vẽ sao cho xưởng sản xuất được mới là thiết kế.'],
 ['nha-o','blue','Khoá học video','Thiết kế|nội thất nhà ở','Tự làm một dự án nhà ở từ đầu đến cuối.'],
 ['du-toan','teal','Khoá học video','Dự toán|thi công nội thất','Làm báo giá bằng Excel, từ file báo giá thật.'],
 ['sale','plum','Khoá học video','Tư vấn thiết kế|cho sale nội thất','Hiểu vật liệu, hiểu xưởng, giao đề bài đúng.'],
 ['cnc','slate','Sắp ra mắt','Ra file cắt CNC|với ABF','Chốt mẫu xong là tự ra file cắt, tránh hỏng ván.'],
];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
for(const [ten,c,k,t,s] of ds){
  const u='file://'+path.join(__dirname,'mau.html')+'?'+new URLSearchParams({c,k,t,s});
  await p.goto(u);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  await p.screenshot({path:path.join(goc,'anh',`video-${ten}.jpg`),type:'jpeg',quality:86});
  console.log('anh/video-'+ten+'.jpg');}
await b.close();})();
