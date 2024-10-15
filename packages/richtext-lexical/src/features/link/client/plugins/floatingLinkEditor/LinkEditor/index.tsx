'use client'
import type { ElementNode, LexicalNode } from 'lexical'
import type { Data, FormState } from 'payload'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { getTranslation } from '@payloadcms/translations'
import {
  CloseMenuIcon,
  EditIcon,
  formatDrawerSlug,
  useConfig,
  useEditDepth,
  useLocale,
  useModal,
  useTranslation,
} from '@payloadcms/ui'
import { requests } from '@payloadcms/ui/shared'
import {
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { LinkFields } from '../../../../nodes/types.js'
import type { LinkPayload } from '../types.js'

import { useEditorConfigContext } from '../../../../../../lexical/config/client/EditorConfigProvider.js'
import { getSelectedNode } from '../../../../../../lexical/utils/getSelectedNode.js'
import { setFloatingElemPositionForLinkEditor } from '../../../../../../lexical/utils/setFloatingElemPositionForLinkEditor.js'
import { FieldsDrawer } from '../../../../../../utilities/fieldsDrawer/Drawer.js'
import { $isAutoLinkNode } from '../../../../nodes/AutoLinkNode.js'
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '../../../../nodes/LinkNode.js'
import { TOGGLE_LINK_WITH_MODAL_COMMAND } from './commands.js'

export function LinkEditor({ anchorElem }: { anchorElem: HTMLElement }): React.ReactNode {
  const [editor] = useLexicalComposerContext()

  const editorRef = useRef<HTMLDivElement | null>(null)
  const [linkUrl, setLinkUrl] = useState<null | string>(null)
  const [linkLabel, setLinkLabel] = useState<null | string>(null)

  const { uuid } = useEditorConfigContext()

  const { config } = useConfig()

  const { i18n, t } = useTranslation()

  const [stateData, setStateData] = useState<
    ({ id?: string; text: string } & LinkFields) | undefined
  >()

  const { closeModal, toggleModal } = useModal()
  const editDepth = useEditDepth()
  const [isLink, setIsLink] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<LexicalNode[]>([])
  const locale = useLocale()

  const [isAutoLink, setIsAutoLink] = useState(false)

  const drawerSlug = formatDrawerSlug({
    slug: `lexical-rich-text-link-` + uuid,
    depth: editDepth,
  })

  const setNotLink = useCallback(() => {
    setIsLink(false)
    if (editorRef && editorRef.current) {
      editorRef.current.style.opacity = '0'
      editorRef.current.style.transform = 'translate(-10000px, -10000px)'
    }
    setIsAutoLink(false)
    setLinkUrl(null)
    setLinkLabel(null)
    setSelectedNodes([])
    setStateData(undefined)
  }, [setIsLink, setLinkUrl, setLinkLabel, setSelectedNodes])

  const $updateLinkEditor = useCallback(async () => {
    const selection = $getSelection()
    let selectedNodeDomRect: DOMRect | undefined

    if (!$isRangeSelection(selection) || !selection) {
      void setNotLink()
      return
    }

    // Handle the data displayed in the floating link editor & drawer when you click on a link node

    const focusNode = getSelectedNode(selection)
    selectedNodeDomRect = editor.getElementByKey(focusNode.getKey())?.getBoundingClientRect()
    const focusLinkParent = $findMatchingParent(focusNode, $isLinkNode)

    // Prevent link modal from showing if selection spans further than the link: https://github.com/facebook/lexical/issues/4064
    const badNode = selection
      .getNodes()
      .filter((node) => !$isLineBreakNode(node))
      .find((node) => {
        const linkNode = $findMatchingParent(node, $isLinkNode)
        return (
          (focusLinkParent && !focusLinkParent.is(linkNode)) ||
          (linkNode && !linkNode.is(focusLinkParent))
        )
      })

    if (focusLinkParent == null || badNode) {
      void setNotLink()
      return
    }

    const fields = focusLinkParent.getFields()

    // Initial state:
    const data: { text: string } & LinkFields = {
      ...fields,
      id: focusLinkParent.getID(),
      text: focusLinkParent.getTextContent(),
    }

    if (fields?.linkType === 'custom') {
      setLinkUrl(fields?.url ?? null)
      setLinkLabel(null)
    } else {
      // internal link
      setLinkUrl(
        `${config.routes.admin === '/' ? '' : config.routes.admin}/collections/${fields?.doc?.relationTo}/${
          fields?.doc?.value
        }`,
      )

      const relatedField = config.collections.find((coll) => coll.slug === fields?.doc?.relationTo)
      if (!relatedField) {
        // Usually happens if the user removed all default fields. In this case, we let them specify the label or do not display the label at all.
        // label could be a virtual field the user added. This is useful if they want to use the link feature for things other than links.
        setLinkLabel(fields?.label ? String(fields?.label) : null)
        setLinkUrl(fields?.url ? String(fields?.url) : null)
      } else {
        const id = typeof fields.doc?.value === 'object' ? fields.doc.value.id : fields.doc?.value
        const collection = fields.doc?.relationTo
        if (!id || !collection) {
          throw new Error(`Focus link parent is missing doc.value or doc.relationTo`)
        }

        const loadingLabel = t('fields:linkedTo', {
          label: `${getTranslation(relatedField.labels.singular, i18n)} - loading...`,
        }).replace(/<[^>]*>?/g, '')
        setLinkLabel(loadingLabel)

        const res = await requests.get(
          `${config.serverURL}${config.routes.api}/${collection}/${id}${locale?.code ? `?locale=${locale.code}` : ''}`,
          {
            headers: {
              'Accept-Language': i18n.language,
            },
            params: {
              depth: 0,
            },
          },
        )
        const data = await res.json()
        const useAsTitle = relatedField?.admin?.useAsTitle || 'id'
        const title = data[useAsTitle]
        const label = t('fields:linkedTo', {
          label: `${getTranslation(relatedField.labels.singular, i18n)} - ${title}`,
        }).replace(/<[^>]*>?/g, '')
        setLinkLabel(label)
      }
    }

    setStateData(data)
    setIsLink(true)
    setSelectedNodes(selection ? selection?.getNodes() : [])

    if ($isAutoLinkNode(focusLinkParent)) {
      setIsAutoLink(true)
    } else {
      setIsAutoLink(false)
    }

    const editorElem = editorRef.current
    const nativeSelection = window.getSelection()
    const { activeElement } = document

    if (editorElem === null) {
      return
    }

    const rootElement = editor.getRootElement()

    if (
      nativeSelection !== null &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      if (!selectedNodeDomRect) {
        // Get the DOM rect of the selected node using the native selection. This sometimes produces the wrong
        // result, which is why we use lexical's selection preferably.
        selectedNodeDomRect = nativeSelection.getRangeAt(0).getBoundingClientRect()
      }

      if (selectedNodeDomRect != null) {
        selectedNodeDomRect.y += 40
        setFloatingElemPositionForLinkEditor(selectedNodeDomRect, editorElem, anchorElem)
      }
    } else if (activeElement == null || activeElement.className !== 'link-input') {
      if (rootElement !== null) {
        setFloatingElemPositionForLinkEditor(null, editorElem, anchorElem)
      }
      setLinkUrl(null)
      setLinkLabel(null)
    }

    return true
  }, [editor, setNotLink, config, locale.code, t, i18n, anchorElem])

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        TOGGLE_LINK_WITH_MODAL_COMMAND,
        (payload: LinkPayload) => {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, payload)

          // Now, open the modal
          void $updateLinkEditor()
          toggleModal(drawerSlug)

          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, $updateLinkEditor, toggleModal, drawerSlug])

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement

    const update = (): void => {
      editor.getEditorState().read(() => {
        void $updateLinkEditor()
      })
    }

    window.addEventListener('resize', update)

    if (scrollerElem != null) {
      scrollerElem.addEventListener('scroll', update)
    }

    return () => {
      window.removeEventListener('resize', update)

      if (scrollerElem != null) {
        scrollerElem.removeEventListener('scroll', update)
      }
    }
  }, [anchorElem.parentElement, editor, $updateLinkEditor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          void $updateLinkEditor()
        })
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          void $updateLinkEditor()
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isLink) {
            setNotLink()

            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH,
      ),
    )
  }, [editor, $updateLinkEditor, isLink, setNotLink])

  useEffect(() => {
    editor.getEditorState().read(() => {
      void $updateLinkEditor()
    })
  }, [editor, $updateLinkEditor])

  return (
    <React.Fragment>
      <div className="link-editor" ref={editorRef}>
        <div className="link-input">
          {linkUrl && linkUrl.length > 0 ? (
            <a href={linkUrl} rel="noopener noreferrer" target="_blank">
              {linkLabel != null && linkLabel.length > 0 ? linkLabel : linkUrl}
            </a>
          ) : linkLabel != null && linkLabel.length > 0 ? (
            <span className="link-input__label-pure">{linkLabel}</span>
          ) : null}

          {editor.isEditable() && (
            <React.Fragment>
              <button
                aria-label="Edit link"
                className="link-edit"
                onClick={() => {
                  toggleModal(drawerSlug)
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                tabIndex={0}
                type="button"
              >
                <EditIcon />
              </button>
              {!isAutoLink && (
                <button
                  aria-label="Remove link"
                  className="link-trash"
                  onClick={() => {
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  tabIndex={0}
                  type="button"
                >
                  <CloseMenuIcon />
                </button>
              )}
            </React.Fragment>
          )}
        </div>
      </div>
      <FieldsDrawer
        className="lexical-link-edit-drawer"
        data={stateData}
        drawerSlug={drawerSlug}
        drawerTitle={t('fields:editLink')}
        featureKey="link"
        handleDrawerSubmit={(fields: FormState, data: Data) => {
          closeModal(drawerSlug)

          const newLinkPayload = data as { text: string } & LinkFields

          const bareLinkFields: LinkFields = {
            ...newLinkPayload,
          }
          delete bareLinkFields.text

          // See: https://github.com/facebook/lexical/pull/5536. This updates autolink nodes to link nodes whenever a change was made (which is good!).
          editor.update(() => {
            const selection = $getSelection()
            let linkParent: ElementNode | null = null
            if ($isRangeSelection(selection)) {
              linkParent = getSelectedNode(selection).getParent()
            } else {
              if (selectedNodes.length) {
                linkParent = selectedNodes[0].getParent()
              }
            }

            if (linkParent && $isAutoLinkNode(linkParent)) {
              const linkNode = $createLinkNode({
                fields: bareLinkFields,
              })
              linkParent.replace(linkNode, true)
            }
          })

          // Needs to happen AFTER a potential auto link => link node conversion, as otherwise, the updated text to display may be lost due to
          // it being applied to the auto link node instead of the link node.
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
            fields: bareLinkFields,
            selectedNodes,
            text: newLinkPayload.text,
          })
        }}
        schemaPathSuffix="fields"
      />
    </React.Fragment>
  )
}
