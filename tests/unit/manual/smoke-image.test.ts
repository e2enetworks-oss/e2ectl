import { deleteSavedImage } from '../../../scripts/helpers/manual-smoke-image.mjs';

describe('manual smoke saved image helper', () => {
  it('sends the legacy saved-image delete request through transport', async () => {
    const transport = {
      request: vi.fn(() => Promise.resolve({}))
    };

    await deleteSavedImage(transport, 'img-455');

    expect(transport.request).toHaveBeenCalledWith({
      body: {
        action_type: 'delete_image'
      },
      method: 'PUT',
      path: '/images/img-455/'
    });
  });
});
