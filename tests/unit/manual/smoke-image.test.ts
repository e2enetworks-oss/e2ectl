import { deleteSavedImage } from '../../../scripts/helpers/manual-smoke-image.mjs';

describe('manual smoke saved image helper', () => {
  it('sends the saved-image delete request through transport.delete', async () => {
    const transport = {
      delete: vi.fn(() => Promise.resolve({}))
    };

    await deleteSavedImage(transport, 'img-455');

    expect(transport.delete).toHaveBeenCalledWith('/images/img-455/');
  });
});
