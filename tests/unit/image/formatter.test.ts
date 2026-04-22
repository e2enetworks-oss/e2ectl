import {
  formatImageTable,
  renderImageResult
} from '../../../src/image/formatter.js';
import { stableStringify } from '../../../src/core/json.js';

function makeItem(overrides = {}) {
  return {
    creation_time: '01-Jan-2025 10:00:00',
    image_id: '1001',
    image_name: 'my-image',
    image_size: '20GB',
    image_state: 'READY',
    is_windows: false,
    node_plans_available: true,
    os_distribution: 'Ubuntu 22.04',
    project_name: 'default-project',
    running_vms: 2,
    scaler_group_count: 3,
    template_id: 1448,
    ...overrides
  };
}

describe('image formatter', () => {
  it('renders a stable image table with scale group count column', () => {
    const table = formatImageTable([makeItem()]);

    expect(table).toContain('1001');
    expect(table).toContain('my-image');
    expect(table).not.toContain('Ubuntu 22.04');
    expect(table).toContain('20GB');
    expect(table).toContain('READY');
    expect(table).toContain('Scale Groups');
    expect(table).toContain('3');
  });

  it('sorts rows by name then id', () => {
    const table = formatImageTable([
      makeItem({ image_id: '2000', image_name: 'zebra' }),
      makeItem({ image_id: '1001', image_name: 'alpha' })
    ]);

    const alphaPos = table.indexOf('alpha');
    const zebraPos = table.indexOf('zebra');
    expect(alphaPos).toBeLessThan(zebraPos);
  });

  it('renders human list output', () => {
    const output = renderImageResult(
      { action: 'list', items: [makeItem()] },
      false
    );

    expect(output).toContain('my-image');
    expect(output).toContain('Scale Groups');
  });

  it('renders empty list message', () => {
    const output = renderImageResult({ action: 'list', items: [] }, false);
    expect(output).toBe('No saved images found.\n');
  });

  it('renders human delete output for confirmed deletion', () => {
    const output = renderImageResult(
      {
        action: 'delete',
        cancelled: false,
        id: '1001',
        message: 'Image deleted successfully'
      },
      false
    );
    expect(output).toContain('Deleted image 1001');
    expect(output).toContain('Image deleted successfully');
  });

  it('renders human delete output for cancelled deletion', () => {
    const output = renderImageResult(
      { action: 'delete', cancelled: true, id: '1001' },
      false
    );
    expect(output).toBe('Deletion cancelled.\n');
  });

  it('renders human rename output', () => {
    const output = renderImageResult(
      {
        action: 'rename',
        id: '1001',
        message: 'Image name changed successfully',
        name: 'new-name'
      },
      false
    );
    expect(output).toContain('Renamed image 1001 to: new-name');
  });

  it('renders stable json list output with scaler_group_count', () => {
    const output = renderImageResult(
      { action: 'list', items: [makeItem()] },
      true
    );

    const parsed = JSON.parse(output) as {
      action: string;
      items: Array<{ scaler_group_count: number }>;
    };
    expect(parsed.action).toBe('list');
    expect(parsed.items[0]?.scaler_group_count).toBe(3);
  });

  it('renders deterministic json for delete cancelled', () => {
    const output = renderImageResult(
      { action: 'delete', cancelled: true, id: '1001' },
      true
    );
    expect(output).toBe(
      `${stableStringify({ action: 'delete', cancelled: true, id: '1001' })}\n`
    );
  });

  it('renders deterministic json for rename', () => {
    const output = renderImageResult(
      {
        action: 'rename',
        id: '1001',
        message: 'Image name changed successfully',
        name: 'new-name'
      },
      true
    );
    const parsed = JSON.parse(output) as {
      action: string;
      name: string;
    };
    expect(parsed.action).toBe('rename');
    expect(parsed.name).toBe('new-name');
  });
});
