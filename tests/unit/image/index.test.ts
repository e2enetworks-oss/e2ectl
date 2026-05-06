import * as imageIndex from '../../../src/image/index.js';
import * as imageTypes from '../../../src/image/types.js';
import { buildImageCommand } from '../../../src/image/command.js';
import { ImageApiClient } from '../../../src/image/client.js';

describe('image module exports', () => {
  it('re-exports the public image runtime surface', () => {
    expect(imageIndex.buildImageCommand).toBe(buildImageCommand);
    expect(imageIndex.ImageApiClient).toBe(ImageApiClient);
  });

  it('exposes shared image constants from the types module', () => {
    expect(imageTypes.IMAGE_ACTION_RENAME).toBe('rename');
  });
});
