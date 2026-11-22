import { Parser } from 'htmlparser2';
import { imageResponse, readImageStream, recordImage } from '../worker.mjs';

async function readMetadata(response) {
  const images = new Map();
  const decoder = new TextDecoder();
  const parser = new Parser({
    onopentag(tag, attributes) {
      recordImage(images, tag, name => attributes[name]);
    }
  });
  await readImageStream(response.body, images, chunk => {
    parser.write(decoder.decode(chunk, { stream: true }));
  });
  parser.end(decoder.decode());
  return images;
}

export function GET(request) {
  return imageResponse(request, readMetadata);
}
