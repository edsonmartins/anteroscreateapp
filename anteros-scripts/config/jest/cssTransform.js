// @remove-on-eject-begin
/*******************************************************************************
 * Copyright 2019 Anteros Tecnologia
 *  
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *  
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
// @remove-on-eject-end
'use strict';

// Este é um transformador Jest personalizado transformando as importações de estilo em objetos vazios.

module.exports = {
  process() {
    return 'module.exports = {};';
  },
  getCacheKey() {
    // A saída é sempre a mesma.
    return 'cssTransform';
  },
};
