import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import useFieldType from '../../useFieldType';
import Label from '../../Label';
import Button from '../../../elements/Button';
import CopyToClipboard from '../../../elements/CopyToClipboard';
import { text } from '../../../../../fields/validations';
import useFormFields from '../../Form/useFormFields';

import './index.scss';

const path = 'apiKey';
const baseClass = 'api-key';
const validate = val => text(val, { minLength: 24, maxLength: 48 });

const APIKey = (props) => {
  const {
    initialData,
  } = props;

  const { getField } = useFormFields();

  const apiKey = getField(path);

  const apiKeyValue = apiKey?.value;

  const APIKeyLabel = useMemo(() => (
    <div className={`${baseClass}__label`}>
      <span>
        API Key
      </span>
      <CopyToClipboard value={apiKeyValue} />
    </div>
  ), [apiKeyValue]);

  const fieldType = useFieldType({
    path: 'apiKey',
    initialData: initialData || uuidv4(),
    validate,
  });

  const {
    value,
    setValue,
  } = fieldType;

  const classes = [
    'field-type',
    'api-key',
    'read-only',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={classes}>
        <Label
          htmlFor={path}
          label={APIKeyLabel}
        />
        <input
          value={value || ''}
          disabled="disabled"
          type="text"
          id="apiKey"
          name="apiKey"
        />
      </div>
      <Button
        onClick={() => setValue(uuidv4())}
        size="small"
        buttonStyle="secondary"
      >
        Generate new API Key
      </Button>
    </>
  );
};

APIKey.defaultProps = {
  initialData: undefined,
};

APIKey.propTypes = {
  initialData: PropTypes.string,
};

export default APIKey;
