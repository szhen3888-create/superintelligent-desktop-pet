const path=require('node:path');
if(process.env.DSH_PET_HOST_PID){require(path.resolve(__dirname,'../engine/runtime/electron-helper/main.js'));}else{require('./client/main.cjs');if(process.argv.includes('--verify-client'))require('./client/verify.cjs');}
