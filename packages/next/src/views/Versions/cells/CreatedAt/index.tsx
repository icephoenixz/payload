'use client'
import { useConfig, useTableCell, useTranslation } from '@payloadcms/ui/client'
import { formatDate } from '@payloadcms/ui/server'
import LinkImport from 'next/link.js'
import React from 'react'

const Link = (LinkImport.default || LinkImport) as unknown as typeof LinkImport.default

type CreatedAtCellProps = {
  collectionSlug?: string
  docID?: number | string
  globalSlug?: string
}

export const CreatedAtCell: React.FC<CreatedAtCellProps> = ({
  collectionSlug,
  docID,
  globalSlug,
}) => {
  const {
    admin: { dateFormat },
    routes: { admin },
  } = useConfig()

  const { i18n } = useTranslation()

  const { cellData, rowData } = useTableCell()

  const versionID = rowData.id

  let to: string

  if (collectionSlug) to = `${admin}/collections/${collectionSlug}/${docID}/versions/${versionID}`

  if (globalSlug) to = `${admin}/globals/${globalSlug}/versions/${versionID}`

  return (
    <Link href={to}>
      {cellData &&
        formatDate({ date: cellData as Date | number | string, i18n, pattern: dateFormat })}
    </Link>
  )
}