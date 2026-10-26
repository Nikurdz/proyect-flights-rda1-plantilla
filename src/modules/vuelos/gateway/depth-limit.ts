import { FragmentDefinitionNode, GraphQLError, SelectionSetNode, ValidationContext, ValidationRule } from 'graphql';

function profundidad(seleccion: SelectionSetNode, contexto: ValidationContext, vistos: ReadonlySet<string>): number {
  let max = 0;
  for (const s of seleccion.selections) {
    if (s.kind === 'Field') {
      if (s.name.value.startsWith('__')) continue; // introspection is deep by nature
      max = Math.max(max, 1 + (s.selectionSet ? profundidad(s.selectionSet, contexto, vistos) : 0));
    } else if (s.kind === 'InlineFragment') {
      max = Math.max(max, profundidad(s.selectionSet, contexto, vistos));
    } else if (!vistos.has(s.name.value)) {
      const fragmento: FragmentDefinitionNode | null | undefined = contexto.getFragment(s.name.value);
      if (fragmento) max = Math.max(max, profundidad(fragmento.selectionSet, contexto, new Set([...vistos, s.name.value])));
    }
  }
  return max;
}

/** Rejects a query nested deeper than `limite` fields: a cheap defence against queries built to be expensive. */
export function limiteDeProfundidad(limite: number): ValidationRule {
  return (contexto) => ({
    OperationDefinition(nodo) {
      const p = profundidad(nodo.selectionSet, contexto, new Set());
      if (p > limite) contexto.reportError(new GraphQLError(`The query is ${p} levels deep; the limit is ${limite}.`, { nodes: [nodo], extensions: { code: 'QUERY_TOO_DEEP' } }));
    },
  });
}
