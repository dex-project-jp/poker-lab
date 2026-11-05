import {enumerateAnalysis} from '../solver/simple-analysis.js';
self.onmessage=({data})=>{
 try{
  const iterator=enumerateAnalysis(data);let step;
  do{step=iterator.next();if(!step.done)self.postMessage({progress:step.value});}while(!step.done);
  self.postMessage({result:step.value});
 }catch(error){self.postMessage({error:error.message});}
};
