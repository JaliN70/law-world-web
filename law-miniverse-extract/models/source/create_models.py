"""Procedural model sources. No website/source-site files are modified."""
import os, json, struct, math, io
os.environ['PYOPENGL_PLATFORM']='egl'
from pathlib import Path
import numpy as np
np.infty = np.inf
import trimesh as tm
import DracoPy
from PIL import Image, ImageDraw, ImageFont
import pyrender
ROOT=Path('/workspace/law-miniverse/models'); ROOT.mkdir(exist_ok=True)
COLORS=['#1F4E79','#FF0000','#B5533C','#9CA3AF','#3B6FB6','#7FA77F','#3E8E8A','#8B6FC9','#D1D5DB','#86B86B','#5E9E4F','#C9A27A','#F5F1E8','#4B5563','#F2C94C','#5DADE2']
PAL=Image.new('RGB',(1024,1024))
pd=ImageDraw.Draw(PAL)
for i,c in enumerate(COLORS): pd.rectangle(((i%4)*256,(i//4)*256,(i%4+1)*256-1,(i//4+1)*256-1),fill=c)
PAL.save(ROOT/'palette.png',optimize=True)
PBYTES=(ROOT/'palette.png').read_bytes()
class Model:
 def __init__(self,name): self.name=name; self.parts=[]
 def add(self,m,c):
  if isinstance(c,str): c=COLORS.index(c)
  self.parts.append((m,c)); return m
 def box(self,p,s,c,bevel=0):
  h=np.array(s)/2
  if bevel:
   r=min(bevel,min(h)*.75); vs=[]
   for axis in range(3):
    for signs in np.ndindex(2,2,2):
     q=(h-r)*np.array([1 if a else -1 for a in signs]); q[axis]=h[axis]*(1 if signs[axis] else -1); vs.append(q)
   m=tm.convex.convex_hull(np.array(vs))
  else: m=tm.creation.box(extents=s)
  m.apply_translation(p); return self.add(m,c)
 def cyl(self,p,r,h,c,n=12,r2=None):
  if r2 is None: m=tm.creation.cylinder(radius=r,height=h,sections=n)
  else:
   verts=[]
   for y,rr in [(-h/2,r),(h/2,r2)]:
    verts += [[rr*math.cos(t*2*math.pi/n),rr*math.sin(t*2*math.pi/n),y] for t in range(n)]
   m=tm.convex.convex_hull(np.array(verts))
  m.apply_transform(tm.transformations.rotation_matrix(-math.pi/2,[1,0,0])); m.apply_translation(p); return self.add(m,c)
 def rod(self,a,b,r,c,n=8):
  a,b=np.array(a),np.array(b); m=tm.creation.cylinder(radius=r,height=np.linalg.norm(b-a),sections=n)
  m.apply_transform(tm.geometry.align_vectors([0,0,1],b-a)); m.apply_translation((a+b)/2); return self.add(m,c)
 def ring(self,p,r,t,c,axis='y',n=24):
  m=tm.creation.torus(major_radius=r,minor_radius=t,major_sections=n,minor_sections=6)
  if axis=='y': m.apply_transform(tm.transformations.rotation_matrix(-math.pi/2,[1,0,0]))
  if axis=='x': m.apply_transform(tm.transformations.rotation_matrix(math.pi/2,[0,1,0]))
  m.apply_translation(p); return self.add(m,c)
 def wedge(self,x,z,w,d,y0,y1,c):
  v=np.array([[x-w/2,.25,z-d/2],[x+w/2,.25,z-d/2],[x+w/2,.25,z+d/2],[x-w/2,.25,z+d/2],[x-w/2,y1,z-d/2],[x+w/2,y1,z-d/2],[x+w/2,y0,z+d/2],[x-w/2,y0,z+d/2]])
  return self.add(tm.convex.convex_hull(v),c)
 def plate(self):
  self.box((0,.125,0),(8,.25,8),8,.07)
  # restrained paver joints; all geometry stays within the common tile
  for x in [-3,-2,-1,0,1,2,3]: self.box((x,.251,3.5),(.018,.008,.94),3)
 def roof(self,x,z,w,d,y,c):
  self.box((x,y,z),(w,.2,d),c,.055)
  for xx in [x-w/2+.1,x+w/2-.1]: self.box((xx,y+.19,z),(.17,.25,d),12,.025)
  for zz in [z-d/2+.1,z+d/2-.1]: self.box((x,y+.19,zz),(w,.25,.17),12,.025)
 def window(self,x,y,z,w=1,h=1):
  self.box((x,y,z),(w+.14,h+.14,.08),12,.025); self.box((x,y,z+.05),(w,h,.045),13)
  self.box((x,y,z+.08),(.045,h,.025),3)
 def shrub(self,x,z):
  self.box((x,.35,z),(.7,.17,.9),11,.08)
  m=tm.creation.icosphere(subdivisions=1,radius=.38);m.apply_scale([1,.8,1.2]);m.apply_translation((x,.65,z)); self.add(m,10)
 def arrays(self):
  # Expand vertices for sharp, clean flat normals and UV-isolated palette swatches.
  pos=[]; norms=[];uv=[]; facecolors=[]
  for m,c in self.parts:
   v=np.asarray(m.vertices)[m.faces].reshape(-1,3)
   pos.append(v);norms.append(np.repeat(m.face_normals,3,axis=0))
   uv.append(np.tile([(c%4+.5)/4,(c//4+.5)/4],(len(v),1)))
   facecolors.extend([c]*len(m.faces))
  p=np.concatenate(pos);n=np.concatenate(norms);u=np.concatenate(uv);f=np.arange(len(p),dtype=np.uint32).reshape(-1,3)
  return p,n,u,f,np.array(facecolors)

def make_fire():
 m=Model('fire');m.plate()
 m.box((0,2.4,-.7),(6.5,4.3,4.8),2,.10)
 # right rear annex gives a gentle L-shaped shoulder
 m.box((2.8,1.65,-2.7),(1.25,2.8,1.6),2,.07)
 m.roof(0,-.7,6.75,5.05,4.62,2)
 for x in [-1.62,1.62]:
  m.box((x,1.62,1.74),(2.65,2.7,.12),12,.04)
  m.box((x,1.6,1.83),(2.4,2.48,.1),2,.025)
  for yy in [1.05,1.5,1.95]: m.box((x,yy,1.89),(2.3,.045,.025),13)
  for xx in [x-.62,x+.62]:m.box((xx,2.2,1.90),(.65,.36,.035),13,.015)
  m.box((x,.4,2.05),(2.65,.15,.5),8)
 for xx in [-2.25,0,2.25]:m.window(xx,3.85,1.74,.7,.65)
 for zz in [-2,-.3,1.1]:
  m.box((3.29,2.9,zz),(.06,.9,.62),13)
 # tower on rear-left; open monitoring band
 m.box((-1.6,6.02,-1.85),(1.65,2.7,1.65),2,.04)
 m.box((-1.6,7.7,-1.85),(2.0,.25,2.0),2,.04)
 for x in [-2.35,-.85]:
  for z in [-2.6,-1.1]:m.box((x,8.2,z),(.15,.8,.15),2)
 m.box((-1.6,8.15,-1.85),(1.5,.58,1.5),13)
 m.box((-1.6,8.66,-1.85),(2.08,.18,2.08),2,.025)
 # four-sided pyramidal cap
 cap=m.cyl((-1.6,9.02,-1.85),1.48,.55,2,n=4,r2=.025)
 cap.apply_transform(tm.transformations.rotation_matrix(math.pi/4,[0,1,0],point=[-1.6,9.02,-1.85]))
 m.rod((-1.6,9.3,-1.85),(-1.6,9.55,-1.85),.035,3)
 # subtle masonry joints, not a pixel pattern
 for yy in [1,2,3,4]: m.box((0,yy,1.714),(6.35,.018,.008),11)
 # hydrant: only geometry in the palette's pure red swatch
 m.cyl((-2.6,.35,3.1),.28,.18,1);m.cyl((-2.6,.78,3.1),.17,.75,1)
 m.cyl((-2.6,1.19,3.1),.22,.18,1,r2=.10)
 m.rod((-2.95,.91,3.1),(-2.25,.91,3.1),.10,1)
 for x in [3.5,-3.5]:m.shrub(x,1.8)
 return m

def make_building():
 m=Model('building');m.plate();m.box((0,2.9,-.55),(6.2,5.3,5.1),3,.1)
 # dark glass curtain wall and a regular concrete/brise-soleil grid
 m.box((0,3.1,2.03),(5.65,4.6,.06),13)
 for x in [-2.8,-1.85,-.93,0,.93,1.85,2.8]:m.box((x,3.1,2.15),(.13,4.8,.23),3,.02)
 for y in [.9,2.45,4.0,5.35]:m.box((0,y,2.15),(5.9,.14,.23),12,.015)
 for z in [-2.7,-1.45,-.2,1.05]:
  m.box((3.125,3.1,z),(.05,3.9,.9),13)
  m.box((3.19,3.1,z-.48),(.18,4.5,.12),3)
 m.roof(0,-.55,6.5,5.4,5.62,3)
 for x in [-1.45,1.3]:m.box((x,5.95,-1.2),(1.25,.46,1.05),3,.07)
 m.box((0,2.62,2.65),(3.3,.22,1.5),3,.07)
 for x in [-1.35,1.35]:m.box((x,1.47,2.85),(.17,2.3,.17),12)
 m.box((0,.38,2.75),(3.5,.26,1.1),8)
 # drafting compass sculpture, left side of forecourt; brass-toned palette earth
 m.cyl((-2.45,.35,3.0),.64,.18,3,n=16)
 for x in [-2.94,-1.96]:m.rod((x,.45,3.0),(-2.45,1.98,3.0),.075,11)
 m.rod((-2.45,1.98,3.0),(-2.45,2.18,3.0),.075,11)
 m.ring((-2.45,1.12,3.02),.52,.045,11,axis='z')
 m.rod((-2.95,1.0,3.0),(-1.94,1.0,3.0),.045,11)
 for z in [-2,0,1.6]:m.shrub(-3.55,z)
 return m

def make_telecom():
 m=Model('telecom');m.plate();m.box((0,1.98,-.25),(5.7,3.45,5.4),4,.10)
 m.roof(0,-.25,6,5.7,3.82,4)
 m.box((-.8,1.4,2.49),(1.55,2.25,.08),12,.03);m.box((-.8,1.39,2.55),(1.3,2.08,.07),13)
 m.box((-.8,2.68,2.72),(1.82,.17,.55),4,.03)
 for x in [1.25,2.17]:m.window(x,2.05,2.49,.5,.85)
 for z in [-1.5,.3,1.7]:m.box((2.88,1.9,z),(.06,1,.85),13)
 for x in [-1.6,1.6]:m.box((x,4.17,-1.7),(1,.45,.85),3,.055)
 # tapered lattice tower, open bracing rather than a heavy cylinder
 cx,cz=.35,-.6
 levels=[(4,.75),(5.8,.58),(7.6,.40),(9.4,.22)]
 for i in range(3):
  y0,r0=levels[i];y1,r1=levels[i+1]
  for sx,sz in [(-1,-1),(-1,1),(1,-1),(1,1)]:
   m.rod((cx+sx*r0,y0,cz+sz*r0),(cx+sx*r1,y1,cz+sz*r1),.06,3)
  for ss in [-1,1]:
   m.rod((cx-r0,y0,cz+ss*r0),(cx+r1,y1,cz+ss*r1),.035,12)
   m.rod((cx+r0,y0,cz+ss*r0),(cx-r1,y1,cz+ss*r1),.035,12)
   m.rod((cx+ss*r0,y0,cz-r0),(cx+ss*r1,y1,cz+r1),.035,12)
 for y,r in levels:
  for ss in [-1,1]:
   m.rod((cx-r,y,cz+ss*r),(cx+r,y,cz+ss*r),.045,3)
   m.rod((cx+ss*r,y,cz-r),(cx+ss*r,y,cz+r),.045,3)
 m.rod((cx,9.3,cz),(cx,10.45,cz),.055,3)
 # signals are blue, never red. integrated static rings; web may overlay animation later
 for y,r in [(8.35,.85),(9.65,.68)]:m.ring((cx,y,cz),r,.065,15,axis='z',n=24)
 for y in [7.25,8.5]:
  m.box((cx+.55,y,cz+.1),(.17,.62,.34),12,.06)
 for x in [-3.35,3.35]:m.shrub(x,1.2)
 return m

def make_accessibility():
 m=Model('accessibility');m.plate()
 m.box((0,.62,-1.05),(6.5,.75,4.45),8,.07)
 m.box((0,2.65,-1.05),(6.1,3.35,4.15),5,.10)
 m.roof(0,-1.05,6.5,4.55,4.43,5)
 m.box((0,2.4,1.08),(2.65,2.6,.09),12,.025);m.box((0,2.38,1.15),(2.38,2.4,.05),13)
 m.box((0,2.38,1.19),(.065,2.4,.04),5)
 for x in [-2.25,2.25]:m.window(x,2.75,1.08,.85,1.3)
 m.box((0,3.85,1.45),(3.5,.22,1.1),12,.05)
 # real continuous long ramp, no steps blocking the primary route
 m.wedge(0,2.45,2.25,2.9,.29,1.0,8)
 for x in [-1.17,1.17]:
  for z in [1.05,1.8,2.55,3.85]:
   yy=1.0-(z-1.0)/2.9*.71
   m.rod((x,yy,z),(x,yy+.73,z),.045,3)
  m.rod((x,1.73,1.0),(x,1.02,3.9),.055,12)
 # guide strip follows the ramp rather than floating above it
 for z in np.linspace(1.1,3.7,12):
  yy=1.0-(z-1.0)/2.9*.71+.012
  tile=m.box((0,yy,z),(.42,.025,.20),14)
  for xx in [-.13,0,.13]:m.box((xx,yy+.022,z),(.025,.02,.16),14)
 for x in [-2.5,2.5]:
  for z in [1.7,2.8]:m.shrub(x,z)
 m.box((2.0,4.77,-1.5),(.65,.4,.65),3,.05)
 return m

def make_water():
 m=Model('water');m.plate()
 m.box((-1.35,1.9,.15),(3.55,3.3,4.0),6,.10)
 m.roof(-1.35,.15,3.85,4.3,3.66,6)
 m.box((-1.7,1.4,2.18),(1.2,2.2,.08),12,.03);m.box((-1.7,1.4,2.24),(1.02,2.05,.06),13)
 m.window(-.4,2.15,2.18,.65,.9)
 m.box((-1.55,4.0,-.35),(.75,.43,.65),3,.04)
 # tower at back-right, four legs and cross braces
 cx,cz=1.7,-1.55
 for sx,sz in [(-1,-1),(-1,1),(1,-1),(1,1)]:
  m.box((cx+sx*.85,.38,cz+sz*.85),(.5,.25,.5),3,.04)
  m.rod((cx+sx*.85,.5,cz+sz*.85),(cx+sx*.70,5.6,cz+sz*.70),.10,6)
 for ss in [-1,1]:
  m.rod((cx-.8,.65,cz+ss*.8),(cx+.72,4.8,cz+ss*.72),.06,3)
  m.rod((cx+.8,.65,cz+ss*.8),(cx-.72,4.8,cz+ss*.72),.06,3)
  m.rod((cx+ss*.8,.65,cz-.8),(cx+ss*.72,4.8,cz+.72),.06,3)
 m.cyl((cx,5.5,cz),1.18,.2,6,n=16)
 m.cyl((cx,6.6,cz),1.06,2.0,6,n=16)
 for y in [5.75,7.5]:m.ring((cx,y,cz),1.065,.055,15,n=24)
 m.cyl((cx,7.92,cz),1.15,.65,6,n=16,r2=.06)
 m.cyl((cx,8.3,cz),.09,.14,3)
 # blue inset watercourse with banks
 m.box((.4,.29,3.1),(5.65,.12,1.1),13)
 m.box((.4,.36,3.1),(5.45,.035,.88),15)
 for z in [2.5,3.7]:m.box((.4,.38,z),(5.85,.23,.15),8,.02)
 for x in [-2.58,3.38]:m.box((x,.38,3.1),(.15,.23,1.3),8)
 # external separated supply / discharge pipe runs
 for x in [.8,2.9]:
  pts=[(x,.6,2.9),(x,1.25,2.9),(x,1.25,.7),(x,2.25,.7)]
  for a,b in zip(pts,pts[1:]):m.rod(a,b,.11,4,n=12)
  for z in [1.1,2.4]:m.cyl((x,.64,z),.17,.65,3,n=8)
  m.ring((x,1.25,1.8),.145,.035,12,axis='z',n=12)
 m.rod((2.82,7.3,-1.55),(2.82,1.25,-1.55),.10,6,n=12)
 m.rod((2.82,1.25,-1.55),(2.82,1.25,.7),.10,6,n=12)
 for z in [-2,0,1.7]:m.shrub(-3.6,z)
 return m

def make_electrical():
 m=Model('electrical');m.plate()
 m.box((0,.32,0),(7.5,.16,7.5),7,.07)
 # fence: airy low barrier rather than forbidding industrial walls
 for z in [-3.45,3.45]:
  for x in np.linspace(-3.4,3.4,9):
   if z>0 and abs(x)<1.2:continue
   m.box((x,.95,z),(.09,1.25,.09),3,.018)
  for y in [.63,1.35]:
   if z>0:
    for x in [-2.35,2.35]:m.rod((x-1.05,y,z),(x+1.05,y,z),.045,3)
   else:m.rod((-3.45,y,z),(3.45,y,z),.045,3)
 for x in [-3.45,3.45]:
  for z in np.linspace(-3.4,3.4,9):m.box((x,.95,z),(.09,1.25,.09),3,.018)
  for y in [.63,1.35]:m.rod((x,y,-3.45),(x,y,3.45),.045,3)
 # three friendly softly chamfered transformer volumes
 for x,z,w,h,d in [(0,-1.0,2.6,3.15,2.1),(-2,.65,1.5,2.1,1.7),(2,.65,1.5,2.1,1.7)]:
  m.box((x,.48,z),(w+.2,.22,d+.2),3,.07)
  m.box((x,.58+h/2,z),(w,h,d),7,.20)
  # restrained cooling fins
  for zz in np.linspace(z-d*.32,z+d*.32,5):m.box((x+w/2+.04,.65+h*.4,zz),(.10,h*.60,.10),7,.025)
  for xx in [x-w*.27,x+w*.27]:
   base=.58+h
   m.cyl((xx,base+.42,z),.085,.8,3,n=10)
   for yy in np.linspace(base+.1,base+.7,4):m.cyl((xx,yy,z),.20,.09,12,n=12,r2=.12)
 # little face is a subtle mark, not a huge cartoon mask
 for x in [-.32,.32]:
  eye=m.cyl((x,2.35,.07),.075,.025,13,n=12)
  eye.apply_transform(tm.transformations.rotation_matrix(math.pi/2,[1,0,0],point=[x,2.35,.07]))
 # simple understated smile made of three slender segments
 for a,b in [((-.13,2.14,.075),(0,2.08,.075)),((0,2.08,.075),(.13,2.14,.075))]:m.rod(a,b,.018,13,n=6)
 # rear overhead isolator structure
 for x in [-1.8,1.8]:
  m.cyl((x,1.95,-2.6),.10,3.0,3)
  for y in [2.9,3.1,3.3]:m.cyl((x,y,-2.6),.21,.10,12)
 m.rod((-1.8,3.5,-2.6),(1.8,3.5,-2.6),.08,3)
 for x in [-.65,.65]:m.box((x,3.85,-1),( .38,.30,.38),14,.04)
 return m

def pack_glb(model):
 p,n,u,f,fc=model.arrays()
 assert len(f)<=5000,(model.name,len(f))
 blob=bytearray();views=[];accessors=[]
 def view(b):
  while len(blob)%4:blob.append(0)
  i=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(b)});blob.extend(b);return i
 data=DracoPy.encode(p.astype(np.float32),f,quantization_bits=16,compression_level=9,tex_coord=u.astype(np.float64),normals=n.astype(np.float64),tex_coord_quantization_bits=14,normal_quantization_bits=10)
 decoded=DracoPy.decode(data)
 attrs={ {0:'POSITION',1:'NORMAL',3:'TEXCOORD_0'}[a['attribute_type']]:a['unique_id'] for a in decoded.attributes }
 vi=view(data)
 for ar,typ in [(p,'VEC3'),(n,'VEC3'),(u,'VEC2')]:
  ac={'componentType':5126,'count':len(decoded.points),'type':typ}
  if len(accessors)==0:ac.update(min=decoded.points.min(axis=0).tolist(),max=decoded.points.max(axis=0).tolist())
  accessors.append(ac)
 accessors.append({'componentType':5125,'count':len(f)*3,'type':'SCALAR'})
 imageview=view(PBYTES)
 g={'asset':{'version':'2.0','generator':'Tysic CD procedural low-poly v1.0','copyright':'Tysic工程資訊部'},'extensionsUsed':['KHR_draco_mesh_compression'],'extensionsRequired':['KHR_draco_mesh_compression'],
 'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':model.name,'mesh':0,'extras':{'upAxis':'+Y','frontAxis':'+Z','metersPerUnit':1,'pivot':'tile bottom center'}}],
 'meshes':[{'name':model.name,'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0,'mode':4,'extensions':{'KHR_draco_mesh_compression':{'bufferView':vi,'attributes':attrs}}}]}],
 'materials':[{'name':'park_palette','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.88}}],
 'textures':[{'sampler':0,'source':0}],'samplers':[{'magFilter':9728,'minFilter':9728,'wrapS':33071,'wrapT':33071}],
 'images':[{'name':'palette','bufferView':imageview,'mimeType':'image/png'}],
 'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(blob)}],
 'extras':{'coordinateSystem':'right-handed; +Y up; +Z front; meters','designEnvelope':'8m x 8m tile; measured MVP dimensions not provided','palette':'shared 16-color atlas; embedded copy equals palette.png'}}
 while len(blob)%4:blob.append(0)
 jb=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();jb+=b' '*((-len(jb))%4)
 out=struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(blob))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(blob),b'BIN\0')+blob
 (ROOT/(model.name+'.glb')).write_bytes(out)
 return {'name':model.name,'triangles':len(f),'bytes':len(out),'min':p.min(axis=0).round(4).tolist(),'max':p.max(axis=0).round(4).tolist(),'sizeXYZ':np.ptp(p,axis=0).round(4).tolist(),'dracoBytes':len(data),'parts':len(model.parts)}

def read_glb(path):
 b=path.read_bytes();ln=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+ln]);bo=20+ln+8
 prim=g['meshes'][0]['primitives'][0];v=g['bufferViews'][prim['extensions']['KHR_draco_mesh_compression']['bufferView']]
 d=DracoPy.decode(b[bo+v['byteOffset']:bo+v['byteOffset']+v['byteLength']])
 # independent actual output-file inspection
 assert g['asset']['version']=='2.0' and not g.get('cameras')
 assert 'KHR_lights_punctual' not in str(g) and all('camera' not in n for n in g['nodes'])
 assert len(g['meshes'])==1 and g['meshes'][0]['name']==path.stem and g['nodes'][0]['name']==path.stem
 assert len(d.faces)<=5000
 for a in g['accessors'][:3]: assert a['count']==len(d.points)
 assert g['accessors'][3]['count']==len(d.faces)*3
 assert not any(k in g['nodes'][0] for k in ['matrix','rotation','scale','translation'])
 assert np.isfinite(d.points).all() and np.isfinite(d.normals).all()
 ar=np.asarray(d.points)[d.faces];areas=np.linalg.norm(np.cross(ar[:,1]-ar[:,0],ar[:,2]-ar[:,0]),axis=1)/2
 assert areas.min()>1e-8,(path.stem,areas.min())
 assert abs(d.points.min(axis=0)[1])<.002
 assert np.max(np.abs(d.points.min(axis=0)-[-4,0,-4]))<.002
 assert np.max(np.abs(d.points.max(axis=0)[[0,2]]-[4,4]))<.002
 # texture audit: UVs strictly in cell centers, pure red only in hydrant geometry
 ci=np.floor(d.tex_coord[:,0]*4).astype(int)+4*np.floor(d.tex_coord[:,1]*4).astype(int)
 if path.stem!='fire': assert 1 not in ci
 else:
  red=d.points[ci==1]; assert np.all((red[:,0]<-2)&(red[:,1]<1.4)&(red[:,2]>2.5))
 return g,d

def preview(path):
 g,d=read_glb(path)
 # Render the decoded final Draco geometry with the actual embedded GLB atlas.
 # This render-only scene owns the camera and lights; they never go into GLB.
 mat=tm.visual.material.PBRMaterial(baseColorTexture=PAL,metallicFactor=0,roughnessFactor=.88)
 mesh=tm.Trimesh(vertices=d.points,faces=d.faces,vertex_normals=d.normals,process=False)
 render_uv=d.tex_coord.copy(); render_uv[:,1]=1-render_uv[:,1] # glTF upper-left to pyrender/OpenGL lower-left
 mesh.visual=tm.visual.TextureVisuals(uv=render_uv,material=mat)
 scene=pyrender.Scene(bg_color=[.965,.966,.954,1],ambient_light=[.6,.6,.6])
 scene.add(pyrender.Mesh.from_trimesh(mesh,smooth=False))
 floor=tm.creation.box(extents=[30,.04,30]);floor.apply_translation([0,-.06,0])
 # Preview background only: avoid a fake horizon; no floor is exported.
 h=d.points[:,1].max();target=np.array([0,h*.43,0])
 cam=np.array([14,12,19.])+target
 z=(cam-target);z/=np.linalg.norm(z);x=np.cross([0,1,0],z);x/=np.linalg.norm(x);y=np.cross(z,x)
 pose=np.eye(4);pose[:3,:3]=np.column_stack([x,y,z]);pose[:3,3]=cam
 scene.add(pyrender.OrthographicCamera(xmag=6.65,ymag=6.65,znear=.1,zfar=200),pose=pose)
 lp=np.eye(4);lp[:3,:3]=pose[:3,:3];lp[:3,3]=[5,16,12]
 scene.add(pyrender.DirectionalLight(color=np.ones(3),intensity=1.9),pose=lp)
 r=pyrender.OffscreenRenderer(1000,1000)
 color,depth=r.render(scene,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL);r.delete()
 im=Image.fromarray(color);im.save(ROOT/'previews'/f'{path.stem}.png')
 return im

if __name__=='__main__':
 stats=[]
 for fun in [make_fire,make_building,make_telecom,make_accessibility,make_water,make_electrical]:
  m=fun();s=pack_glb(m);stats.append(s);print(s,flush=True)
 (ROOT/'model-stats.json').write_text(json.dumps(stats,indent=2,ensure_ascii=False))
 ims=[preview(ROOT/(s['name']+'.glb')) for s in stats]
 sheet=Image.new('RGB',(2400,1020),'#F5F1E8');draw=ImageDraw.Draw(sheet)
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
 for i,(im,s) in enumerate(zip(ims,stats)):
  x=(i%3)*800;y=(i//3)*510
  sheet.paste(im.resize((465,465)),(x+168,y))
  draw.text((x+30,y+42),s['name'],font=font,fill='#1F4E79')
  draw.text((x+30,y+80),f"{s['triangles']:,} tris",font=small,fill='#4B5563')
  draw.text((x+30,y+110),f"{s['bytes']/1024:.1f} KiB",font=small,fill='#4B5563')
  draw.text((x+30,y+140),f"8 x 8 m tile",font=small,fill='#4B5563')
 sheet.save(ROOT/'previews'/'contact-sheet.png')
 lineup=Image.new('RGB',(3000,650),'#F5F1E8'); ld=ImageDraw.Draw(lineup)
 for i,(im,s) in enumerate(zip(ims,stats)):
  lineup.paste(im.resize((500,500)),(i*500,50))
  ld.text((i*500+25,558),s['name'],font=font,fill='#1F4E79')
  ld.text((i*500+25,600),f"{s['triangles']:,} tris / {s['bytes']/1024:.1f} KiB",font=small,fill='#4B5563')
 lineup.save(ROOT/'previews'/'six-lineup.png')
 print('ALL MODELS RENDERED AND FILES VALIDATED',flush=True)
