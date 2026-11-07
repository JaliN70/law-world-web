const fs=require('fs'),path=require('path');
const {NodeIO}=require('@gltf-transform/core');
const {KHRDracoMeshCompression}=require('@gltf-transform/extensions');
const draco=require('draco3dgltf');
const validator=require('gltf-validator');
const ROOT='/workspace/law-miniverse/models';
(async()=>{
 const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
 const reports=[],validation={};
 for(const name of ['fire','building','telecom','accessibility','water','electrical']){
  const file=path.join(ROOT,name+'.glb'),bytes=fs.readFileSync(file);
  const vr=await validator.validateBytes(new Uint8Array(bytes),{uri:name+'.glb'});
  if(vr.issues.numErrors||vr.issues.numWarnings)throw new Error(name+': validator errors/warnings');validation[name]=vr;
  const d=await io.read(file),r=d.getRoot(),mesh=r.listMeshes()[0],p=mesh.listPrimitives()[0];
  const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),norm=p.getAttribute('NORMAL');
  const atlas=p.getMaterial().getBaseColorTexture().getImage();
  if(Buffer.compare(Buffer.from(atlas),fs.readFileSync(path.join(ROOT,'palette.png')))) throw Error('Wrong atlas');
  const min=pos.getMin([]),max=pos.getMax([]);
  const report={name:mesh.getName(),bytes:bytes.length,triangles:p.getIndices().getCount()/3,positions:pos.getCount(),uv:uv.getCount(),normals:norm.getCount(),cameras:r.listCameras().length,min,max,sizeXYZ:max.map((a,i)=>a-min[i]),textureBytes:atlas.length};
  if(report.name!==name||report.cameras!==0||report.triangles>5000||r.listMeshes().length!==1)throw new Error('FAIL');
  reports.push(report);console.log(name,report.triangles,report.bytes,'PASS');
 }
 fs.writeFileSync(path.join(ROOT,'validation-decoded.json'),JSON.stringify(reports,null,2));
 fs.writeFileSync(path.join(ROOT,'validation-khronos.json'),JSON.stringify(validation,null,2));
})();
