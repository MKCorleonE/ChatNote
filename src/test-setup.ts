import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
Element.prototype.scrollIntoView = function() {};
Element.prototype.scrollTo = function() {};
Range.prototype.getBoundingClientRect = () => ({ x:100,y:100,left:100,top:100,right:250,bottom:120,width:150,height:20,toJSON(){} });
