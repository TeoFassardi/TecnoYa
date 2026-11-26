import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createAuth } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { Product } from '../src/product.js';
const mongo=await MongoMemoryReplSet.create({replSet:{count:1}});
const uri=mongo.getUri('tecnoya_browser_test');
await mongoose.connect(uri);
const {auth,client}=createAuth(uri,'browser-test-only-secret-at-least-32-characters','http://127.0.0.1:4173');
await client.connect();
await auth.api.signUpEmail({body:{name:'Admin de prueba',email:'admin@example.com',password:'BrowserTest123!'}});
await client.db().collection('user').updateOne({email:'admin@example.com'},{$set:{role:'admin'}});
for(const [category,name] of [['teclados','Teclado de demostración'],['mouse','Mouse de demostración'],['auriculares','Auriculares de demostración'],['monitores','Monitor de demostración']]){
  await Product.create({name,description:'Producto ilustrativo para verificar la interfaz.',category,brand:'TecnoYa',priceCents:5000000,stock:5});
}
const server = createApp(auth, 'http://127.0.0.1:4173', {
  async upload() { return 'https://storage.example.com/fixture.png'; },
  owns(url) { return url === 'https://storage.example.com/fixture.png'; },
  async remove() {},
}, async () => {
  const product = await Product.findOne({ category: 'teclados', archivedAt: null }).orFail();
  return {
    message: "Encontré un teclado con stock en el catálogo.",
    products: [{
      id: product.id, name: product.name, brand: product.brand, category: product.category,
      imageUrl: product.imageUrl, priceCents: product.priceCents, stock: product.stock,
    }],
  };
}).listen(4173, '127.0.0.1');
async function close(){server.close();await mongoose.disconnect();await client.close();await mongo.stop();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
