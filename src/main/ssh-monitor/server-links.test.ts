import { describe, expect, it } from 'vitest'
import { parseServerLinks } from './server-links'

describe('parseServerLinks', () => {
  it('keeps well-formed links and skips the rest', () => {
    const links = parseServerLinks(
      JSON.stringify([
        {
          label: ' Monitoring ',
          url: 'http://127.0.0.1:13000/d/overview?host=a',
          tunnel: '13000:127.0.0.1:3000'
        },
        { label: 'Docs', url: 'https://example.com/docs' },
        {
          label: 'Via alias',
          url: 'http://127.0.0.1:2',
          tunnel: '2:127.0.0.1:3000',
          ssh: 'my-server'
        },
        { label: 'Bad alias', url: 'http://127.0.0.1:3', tunnel: '3:127.0.0.1:3000', ssh: 'a b' },
        { label: 'No scheme', url: 'example.com' },
        { label: '', url: 'https://example.com' },
        { label: 'Bad tunnel', url: 'http://127.0.0.1:1', tunnel: '1:host' },
        { label: 'Port out of range', url: 'http://127.0.0.1:1', tunnel: '70000:host:22' },
        { label: 'Option injection', url: 'http://127.0.0.1:1', tunnel: '1:-oProxyCommand=x:2' },
        'garbage'
      ])
    )
    expect(links).toEqual([
      {
        label: 'Monitoring',
        url: 'http://127.0.0.1:13000/d/overview?host=a',
        tunnel: '13000:127.0.0.1:3000',
        ssh: null
      },
      { label: 'Docs', url: 'https://example.com/docs', tunnel: null, ssh: null },
      {
        label: 'Via alias',
        url: 'http://127.0.0.1:2',
        tunnel: '2:127.0.0.1:3000',
        ssh: 'my-server'
      }
    ])
  })

  it('returns nothing for a file that is not a JSON array', () => {
    expect(parseServerLinks('{"label":"x"}')).toEqual([])
    expect(parseServerLinks('not json')).toEqual([])
  })
})
