import React from 'react';

export default function InputWithIcon({
    field,
    label,
    type,
    placeholder,
    editable = true,
    renderIcon,
    defaultValue
}: {
    field: string,
    label: string,
    type: string,
    placeholder: string,
    editable?: boolean,
    renderIcon: React.JSX.Element
    defaultValue?: string
}) {
    return (
        <div className="flex flex-col">
            <label htmlFor={field}>{label}</label>
            <div className="relative">
                <input
                    className="peer rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                    id={field}
                    name={field}
                    type={type}
                    placeholder={placeholder}
                    readOnly={!editable}
                    defaultValue={defaultValue}
                />
                {renderIcon}
            </div>
        </div>
    )
}