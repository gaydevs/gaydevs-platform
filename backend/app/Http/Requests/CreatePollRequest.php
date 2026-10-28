<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreatePollRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('question'))) {
            $this->merge(['question' => trim($this->input('question'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $allowNewOptions = $this->boolean('allow_new_options');
        $minimumOptions = $allowNewOptions ? 1 : 2;
        $optionRules = $allowNewOptions
            ? ['nullable', 'string', 'max:255', 'distinct']
            : ['required', 'string', 'min:1', 'max:255', 'distinct'];

        return [
            'question' => ['required', 'string', 'min:10', 'max:255', 'regex:/^\s*\S+(?:\s+\S+)+\s*$/u'],
            'options' => ['required', 'array', 'min:'.$minimumOptions],
            'options.0' => ['required', 'string', 'min:1', 'max:255', 'distinct'],
            'options.*' => $optionRules,
            'allow_multiple' => ['sometimes', 'boolean'],
            'allow_new_options' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'question.required' => 'A pergunta é obrigatória.',
            'question.string' => 'A pergunta precisa ser um texto.',
            'question.min' => 'A pergunta precisa ter pelo menos :min caracteres.',
            'question.max' => 'A pergunta pode ter no máximo :max caracteres.',
            'question.regex' => 'A pergunta precisa ter pelo menos 2 palavras.',
            'options.required' => 'Adicione as opções da enquete.',
            'options.array' => 'As opções precisam ser informadas em uma lista.',
            'options.min' => 'Informe ao menos :min opções para criar a enquete.',
            'options.*.required' => 'A :attribute é obrigatória.',
            'options.*.string' => 'A :attribute precisa ser um texto.',
            'options.*.min' => 'A :attribute não pode ficar vazia.',
            'options.*.max' => 'A :attribute pode ter no máximo :max caracteres.',
            'options.*.distinct' => 'A :attribute está repetida.',
            'allow_multiple.boolean' => 'A configuração de múltipla escolha é inválida.',
            'allow_new_options.boolean' => 'A configuração de opções abertas é inválida.',
        ];
    }

    public function attributes(): array
    {
        $attributes = [
            'question' => 'pergunta',
            'options' => 'opções',
            'allow_multiple' => 'múltipla escolha',
            'allow_new_options' => 'opções abertas',
        ];

        $options = $this->input('options', []);
        foreach (is_array($options) ? array_keys($options) : [] as $index) {
            $attributes["options.$index"] = 'opção '.((int) $index + 1);
        }

        return $attributes;
    }
}
