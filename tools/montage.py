import sys; from PIL import Image
# python tools/montage.py out.jpg cols w a.jpg b.jpg ...
out,c,w=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); ims=[Image.open(f) for f in sys.argv[4:]]; h=int(w*ims[0].height/ims[0].width)
g=Image.new('RGB',(c*w,((len(ims)+c-1)//c)*h))
for i,m in enumerate(ims): g.paste(m.resize((w,h)),((i%c)*w,(i//c)*h))
g.save(out,quality=86)
