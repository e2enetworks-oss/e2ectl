import * as imageIndex from '../../../../src/myaccount/image/index.js';
import * as imageTypes from '../../../../src/myaccount/image/types.js';
import { buildImageCommand } from '../../../../src/myaccount/image/command.js';
import { ImageApiClient } from '../../../../src/myaccount/image/client.js';

describe('image module exports', () => {
  it('re-exports the public image runtime surface', () => {
    expect(imageIndex.buildImageCommand).toBe(buildImageCommand);
    expect(imageIndex.ImageApiClient).toBe(ImageApiClient);
  });

  it('exposes shared image constants from the types module', () => {
    expect(imageTypes.IMAGE_ACTION_RENAME).toBe('rename');
  });
});
