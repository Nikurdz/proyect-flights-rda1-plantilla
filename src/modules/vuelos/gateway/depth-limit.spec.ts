import { buildSchema, parse, validate } from 'graphql';
import { limiteDeProfundidad } from './depth-limit';

const schema = buildSchema(`
  type Nodo { nombre: String hijo: Nodo }
  type Query { raiz: Nodo }
`);
const errores = (query: string, limite: number) => validate(schema, parse(query), [limiteDeProfundidad(limite)]);

describe('limiteDeProfundidad', () => {
  it('accepts a query within the limit and rejects one beyond it', () => {
    expect(errores('{ raiz { hijo { nombre } } }', 3)).toHaveLength(0);
    const rechazo = errores('{ raiz { hijo { hijo { hijo { nombre } } } } }', 3);
    expect(rechazo).toHaveLength(1);
    expect(rechazo[0].extensions.code).toBe('QUERY_TOO_DEEP');
  });

  it('counts the depth through fragments, and survives a fragment that refers to itself', () => {
    const query = 'query { raiz { ...A } } fragment A on Nodo { hijo { ...B } } fragment B on Nodo { hijo { hijo { nombre } } }';
    expect(errores(query, 3)).toHaveLength(1);
    expect(errores(query, 5)).toHaveLength(0);
    expect(() => errores('query { raiz { ...A } } fragment A on Nodo { hijo { ...A } }', 50)).not.toThrow();
  });

  it('does not count introspection', () => {
    expect(errores('{ __schema { types { fields { type { ofType { ofType { name } } } } } } }', 2)).toHaveLength(0);
  });
});
