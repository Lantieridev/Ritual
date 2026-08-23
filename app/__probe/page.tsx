import { getClient } from '@/src/graphql/client'
import { gql } from 'urql'

const ProbeQuery = gql`
  query CookieProbe {
    __cookieProbe
  }
`

export default async function ProbePage() {
    const { data, error } = await getClient().query(ProbeQuery, {})
    return (
        <pre id="probe-result">
            {JSON.stringify({ value: data?.__cookieProbe ?? null, error: error?.message ?? null }, null, 2)}
        </pre>
    )
}
